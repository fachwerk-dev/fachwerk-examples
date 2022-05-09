import {
  ref,
  h,
  computed,
  onMounted,
  watch,
  watchEffect,
  getCurrentInstance,
} from "vue";
import { Fachwerk, data } from "fachwerk";
import { compileTemplate } from "fachwerk/internal";
import { parse as compileMarkdown } from "marked";
import { parse } from "@slidev/parser";
import { useStorage, useMagicKeys } from "@vueuse/core";

export const Icon = {
  props: ["id"],
  setup(props) {
    const icon = ref("");
    const [collection, name] = props.id.split(":");
    fetch(`https://unpkg.com/@iconify/json/json/${collection}.json`)
      .then((res) => res.json())
      .then(({ icons }) => {
        icon.value = icons[name].body;
      });
    return { icon };
  },
  template: `<svg class="w-5 h-5 inline-block align-middle" viewBox="0 0 24 24" v-html="icon" />`,
};

const Compiler = {
  props: ["code", "setup"],
  setup(props) {
    const Output = computed(() => {
      return {
        setup() {
          //console.log(compileMarkdown(props.code));
          return props.setup;
        },
        render: compileTemplate(compileMarkdown(props.code, { breaks: false }))
          .code,
      };
    });
    return () => h(Output.value);
  },
};

function parseSlides(code) {
  let global = {};
  try {
    return parse(code).slides.map((s) => {
      if (s.frontmatter?.data) {
        Object.entries(s.frontmatter.data).forEach(([key, value]) => {
          data[key] = value;
        });
      }
      if (s.frontmatter?.global) {
        global = { ...global, ...s.frontmatter.global };
      }
      s.frontmatter.global = global;
      s.content = compileMarkdown(s.content);
      return s;
    });
  } catch (e) {
    return [];
  }
}

export function useEditor() {
  const input = ref(null);
  onMounted(() => {
    input.value.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        input.value.setRangeText(
          Array.from({ length: 2 }).fill(" ").join(""),
          input.value.selectionStart,
          input.value.selectionStart,
          "end"
        );
      }
    });
  });
  return input;
}

export function useLoader(key, loader) {
  const saved = useStorage(key, "");
  const current = ref("");
  const save = () => (saved.value = current.value);
  const reset = () =>
    loader().then((original) => {
      saved.value = original;
      current.value = original;
    });
  loader().then((original) => {
    if (saved.value && original !== saved.value) {
      current.value = saved.value;
    } else {
      current.value = original;
    }
  });
  return { current, saved, save, reset };
}

export function useSlides(key, content) {
  const slides = computed(() => parseSlides(content.value));
  const slideIndex = useStorage(key, 0);
  const next = () => {
    if (slideIndex.value < slides.value.length - 1) slideIndex.value++;
  };
  const prev = () => {
    if (slideIndex.value > 0) slideIndex.value--;
  };
  const go = (title) => {
    const index = slides.value.findIndex((s) => s.frontmatter?.title === title);
    if (index > -1) {
      slideIndex.value = index;
    }
  };
  const { shift, left, right } = useMagicKeys();
  watchEffect(() => {
    if (left.value && shift.value) prev();
    if (right.value && shift.value) next();
  });
  return { slides, slideIndex, prev, next, go };
}

export const App = {
  components: { Compiler, Icon },
  setup() {
    const loader = () => fetch("./slides.md").then((res) => res.text());
    const { current, save, reset } = useLoader("slides_code", loader);

    const editor = useEditor();

    const { slides, slideIndex, prev, next, go } = useSlides(
      "slides_index",
      current
    );

    const edit = useStorage("slides_edit", false);

    const app = getCurrentInstance().appContext.app;
    app.use(Fachwerk);
    app.component("Icon", Icon);
    app.config.globalProperties.prev = prev;
    app.config.globalProperties.next = next;
    app.config.globalProperties.go = go;

    return {
      editor,
      current,
      save,
      reset,
      slides,
      slideIndex,
      next,
      prev,
      edit,
    };
  },
  template: `
    <div class="grid grid-cols-1" :class="[edit ? 'grid-cols-[1fr_minmax(0,2fr)]' : 'grid-cols-1']">
      <div v-show="edit" class="relative h-screen sticky top-0">
      <textarea
        ref="editor"
        v-model="current"
        class="w-full h-full leading-6 text-gray-100 bg-gray-900 p-4 text-white font-mono border-none outline-none focus:outline-none"
      />
        <div v-show="edit" class="absolute left-0 bottom-0 right-0 flex justify-end gap-4 text-sm pb-3 pt-8 px-4 bg-gradient-to-t via-gray-900 from-gray-900">
        <div class="px-2 py-1 text-white/25 cursor-pointer" @click="reset">Reset</div>
        <div class="px-2 py-1 bg-amber-500 text-white cursor-pointer rounded" @click="save">Save</div>
        </div>
      </div>
      <div>
        <template v-for="slide in slides">
          <div
            v-show="slide.index === slideIndex"
            class="
              p-12
              max-w-none
              min-h-screen
              prose
              prose:body:text-gray-800
              md:prose-lg
              xl:prose-2xl
              prose-p:max-w-[70ch]
              md:prose-h1:text-6xl
              md:prose-h1:tracking-tight
              prose-code:before:content-none
              prose-code:after:content-none
              prose-code:px-1
              prose-code:rounded
              prose-p:before:content-none
              prose-p:after:content-none
              prose-blockquote:border-l-4
              prose-blockquote:border-yellow-400
              prose-blockquote:pl-6
              prose-blockquote:font-normal
              prose-blockquote:not-italic
              prose-blockquote:text-gray-600
              2xl:prose-p:text-3xl
              2xl:prose-p:leading-relaxed
              2xl:prose-p:my-[2.5vw]
              2xl:prose-h1:text-8xl
              2xl:prose-h2:text-6xl
              2xl:prose-h3:text-4xl
              2xl:prose-h4:text-3xl
              2xl:prose-h5:text-2xl
              2xl:prose-code:text-2xl
              2xl:prose-code:leading-[2.5em]
              2xl:prose-pre:p-[2.5vw]
              2xl:prose-pre:max-w-[120ch]
              2xl:prose-li:text-3xl
            "
            :class="[slide.frontmatter?.global.class,slide.frontmatter?.class]"
          >
            <Compiler :code="slide.content" />
          </div>
        </template>
      </div>
    </div>
    <div class="fixed bottom-3 left-3">
      <Icon id="bx:x" v-if="edit" class="cursor-pointer text-white/50" @click="edit = !edit" />
      <Icon id="bx:pencil" v-if="!edit" class="cursor-pointer text-black/50" @click="edit = !edit" />
    </icon>
    <div class="fixed right-3 bottom-3 flex text-xs text-black/50">
      <Icon id="bx:left-arrow-alt" class="cursor-pointer" @click="prev" />
      <Icon id="bx:right-arrow-alt" class="cursor-pointer" @click="next" />
    </div>
  `,
};

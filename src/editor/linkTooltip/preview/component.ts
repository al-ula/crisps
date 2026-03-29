import { defineComponent, h, type PropType, type Ref } from "vue";
import type { AppLinkTooltipConfig } from "../slices";

const LINK_PATH =
  "M84 128.6H54.6C36.6 128.6 22 114 22 96c0-9 3.7-17.2 9.6-23.1 5.9-5.9 14.1-9.6 23.1-9.6H84m24 65.3h29.4c9 0 17.2-3.7 23.1-9.6 5.9-5.9 9.6-14.1 9.6-23.1 0-18-14.6-32.6-32.6-32.6H108M67.9 96h56.2";
const EDIT_PATH = "M44 132l16.5-4.1L128 60.4 111.6 44 44 111.6zm75.6-88L136 60.4";
const REMOVE_PATH = "M56 58h80m-60 0V42h40v16m12 0l-6 92H70l-6-92";

type PreviewLinkProps = {
  config: Ref<AppLinkTooltipConfig>;
  href: Ref<string>;
  onOpen: Ref<() => void | Promise<void>>;
  onEdit: Ref<() => void>;
  onRemove: Ref<() => void>;
};

export const PreviewLink = defineComponent({
  props: {
    config: {
      type: Object as PropType<Ref<AppLinkTooltipConfig>>,
      required: true,
    },
    href: {
      type: Object as PropType<Ref<string>>,
      required: true,
    },
    onOpen: {
      type: Object as PropType<Ref<() => void | Promise<void>>>,
      required: true,
    },
    onEdit: {
      type: Object as PropType<Ref<() => void>>,
      required: true,
    },
    onRemove: {
      type: Object as PropType<Ref<() => void>>,
      required: true,
    },
  },
  setup(props: PreviewLinkProps) {
    const handleOpen = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      void props.onOpen.value();
    };

    const handleEdit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      props.onEdit.value();
    };

    const handleRemove = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      props.onRemove.value();
    };

    return () =>
      h("div", { class: "app-link-tooltip app-link-tooltip-preview" }, [
        h("span", { class: "app-link-tooltip-icon", "aria-hidden": "true" }, [
          renderIcon(LINK_PATH),
        ]),
        h(
          "button",
          {
            type: "button",
            role: "link",
            class: "app-link-tooltip-url",
            title: props.href.value,
            onMousedown: preventDefault,
            onClick: handleOpen,
          },
          props.href.value,
        ),
        renderActionButton("Edit link", EDIT_PATH, handleEdit),
        renderActionButton("Remove link", REMOVE_PATH, handleRemove),
      ]);
  },
});

function renderActionButton(label: string, path: string, onClick: (event: Event) => void) {
  return h(
    "button",
    {
      type: "button",
      class: "app-link-tooltip-action",
      "aria-label": label,
      title: label,
      onMousedown: preventDefault,
      onClick,
    },
    [renderIcon(path)],
  );
}

function renderIcon(path: string) {
  return h(
    "svg",
    {
      viewBox: "0 0 192 192",
      "aria-hidden": "true",
    },
    [
      h("path", {
        d: path,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "12",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    ],
  );
}

function preventDefault(event: Event) {
  event.preventDefault();
}

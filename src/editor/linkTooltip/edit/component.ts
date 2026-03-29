import { defineComponent, h, ref, watch, type PropType, type Ref } from "vue";
import type { AppLinkTooltipConfig } from "../slices";

const CONFIRM_PATH = "M40 101.3 72 133l80-79";

type EditLinkProps = {
  config: Ref<AppLinkTooltipConfig>;
  showName: Ref<boolean>;
  name: Ref<string>;
  src: Ref<string>;
  onConfirm: (payload: { href: string; name: string }) => void;
  onCancel: () => void;
};

export const EditLink = defineComponent({
  props: {
    config: {
      type: Object as PropType<Ref<AppLinkTooltipConfig>>,
      required: true,
    },
    src: {
      type: Object as PropType<Ref<string>>,
      required: true,
    },
    showName: {
      type: Object as PropType<Ref<boolean>>,
      required: true,
    },
    name: {
      type: Object as PropType<Ref<string>>,
      required: true,
    },
    onConfirm: {
      type: Function as PropType<(payload: { href: string; name: string }) => void>,
      required: true,
    },
    onCancel: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props: EditLinkProps) {
    const link = ref(props.src.value);
    const name = ref(props.name.value);

    watch(props.src, (value) => {
      link.value = value;
    });
    watch(props.name, (value) => {
      name.value = value;
    });

    const onConfirmEdit = () => {
      props.onConfirm({ href: link.value, name: name.value });
    };

    const onKeydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirmEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        props.onCancel();
      }
    };

    return () =>
      h(
        "div",
        {
          class: [
            "app-link-tooltip",
            "app-link-tooltip-edit",
            props.showName.value ? "app-link-tooltip-edit-create" : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
        [
          h(
            "div",
            {
              class: [
                "app-link-tooltip-fields",
                props.showName.value ? "app-link-tooltip-fields-stack" : "",
              ]
                .filter(Boolean)
                .join(" "),
            },
            [
              props.showName.value
                ? h("input", {
                    class: "app-link-tooltip-input",
                    onInput: (event: Event) => {
                      name.value = (event.target as HTMLInputElement).value;
                    },
                    onKeydown,
                    placeholder: props.config.value.textPlaceholder,
                    value: name.value,
                  })
                : null,
              h("input", {
                class: "app-link-tooltip-input",
                onInput: (event: Event) => {
                  link.value = (event.target as HTMLInputElement).value;
                },
                onKeydown,
                placeholder: props.config.value.inputPlaceholder,
                value: link.value,
              }),
            ],
          ),
          link.value.trim()
            ? h(
                "div",
                { class: "app-link-tooltip-actions" },
                [
                  h(
                    "button",
                    {
                      type: "button",
                      class: "app-link-tooltip-action app-link-tooltip-confirm",
                      "aria-label": "Save link",
                      title: "Save link",
                      onMousedown: preventDefault,
                      onClick: (event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onConfirmEdit();
                      },
                    },
                    [renderIcon(CONFIRM_PATH)],
                  ),
                ],
              )
            : null,
        ],
      );
  },
});

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

"use client";

import { VisibilityIcon, VisibilityOffIcon } from "@/assets/icons8";
import { cn } from "@/lib/utils";
import { type HTMLInputTypeAttribute, useId, useState, memo } from "react";
import { TTSButton } from "@/components/A11y/TTSButton";

type InputGroupProps = {
  className?: string;
  label: string;
  placeholder: string;
  type: HTMLInputTypeAttribute;
  fileStyleVariant?: "style1" | "style2";
  required?: boolean;
  disabled?: boolean;
  active?: boolean;
  handleChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value?: string;
  name?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  height?: "sm" | "default";
  defaultValue?: string;
  /** Error message; when set, input gets aria-invalid and aria-describedby for screen readers */
  error?: string;
  /** Optional id for the error element (for aria-describedby). If error is set and this is omitted, a generated id is used. */
  errorId?: string;
  /** Optional aria-label override when label is not sufficient */
  "aria-label"?: string;
  /** Optional ref for the input element (e.g. for focus management) */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** When true, show a "Read aloud" button next to the label for TTS */
  showTts?: boolean;
  /** When true and type is "password", show a clickable eye icon to toggle password visibility */
  showPasswordToggle?: boolean;
};

const InputGroup: React.FC<InputGroupProps> = memo(function InputGroup({
  className,
  label,
  type,
  placeholder,
  required,
  disabled,
  active,
  handleChange,
  icon,
  error,
  errorId: errorIdProp,
  "aria-label": ariaLabel,
  inputRef,
  showTts,
  showPasswordToggle,
  ...props
}) => {
  const id = useId();
  const errorId = errorIdProp ?? (error ? `${id}-error` : undefined);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isPasswordWithToggle = type === "password" && showPasswordToggle;
  const inputType = isPasswordWithToggle ? (passwordVisible ? "text" : "password") : type;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="inline-flex items-center text-body-sm font-medium text-dark dark:text-white"
      >
        {label}
        {required && <span className="ml-1 select-none text-red" aria-hidden>*</span>}
        {showTts && <TTSButton text={label} className="ml-1" />}
      </label>

      <div
        className={cn(
          "relative mt-3 [&_svg]:absolute [&_svg]:top-1/2 [&_svg]:-translate-y-1/2 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:text-dark-4 dark:[&_svg]:text-dark-6",
          props.iconPosition === "left"
            ? "[&_svg]:left-4.5"
            : "[&_svg]:right-4.5",
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type={inputType}
          name={props.name}
          placeholder={placeholder}
          onChange={handleChange}
          value={props.value}
          defaultValue={props.defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? undefined}
          aria-required={required ?? undefined}
          aria-label={ariaLabel}
          className={cn(
            "w-full rounded-lg border-[1.5px] border-stroke bg-transparent outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-default disabled:bg-gray-2 data-[active=true]:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary dark:focus-visible:ring-primary dark:focus-visible:ring-offset-dark-2 dark:disabled:bg-dark dark:data-[active=true]:border-primary",
            type === "file"
              ? getFileStyles(props.fileStyleVariant!)
              : "px-5.5 py-3 text-dark placeholder:text-dark-6 dark:text-white",
            props.iconPosition === "left" ? "pl-12.5" : icon ? "pr-12" : "",
            props.height === "sm" && "py-2.5",
            isPasswordWithToggle && "pr-12",
          )}
          required={required}
          disabled={disabled}
          data-active={active}
        />

        {isPasswordWithToggle ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setPasswordVisible((v) => !v)}
            className="absolute right-4.5 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded p-1 text-dark-6 transition hover:text-dark-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:text-dark-5 dark:hover:text-dark-4 dark:focus:ring-offset-dark-2"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </button>
        ) : (
          icon
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-body-sm text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.value === next.value &&
         prev.error === next.error &&
         prev.disabled === next.disabled;
});

export default InputGroup;

function getFileStyles(variant: "style1" | "style2") {
  switch (variant) {
    case "style1":
      return `file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-[#E2E8F0] file:px-6.5 file:py-[13px] file:text-body-sm file:font-medium file:text-dark-5 file:hover:bg-primary file:hover:bg-opacity-10 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white`;
    default:
      return `file:mr-4 file:rounded file:border-[0.5px] file:border-stroke file:bg-stroke file:px-2.5 file:py-1 file:text-body-xs file:font-medium file:text-dark-5 file:focus:border-primary dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white px-3 py-[9px]`;
  }
}

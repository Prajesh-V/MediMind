import styles from './FormField.module.css';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface BaseFieldProps {
  label: string;
  id: string;
  className?: string;
}

interface InputFieldProps extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  as?: 'input';
}

interface TextareaFieldProps extends BaseFieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  as: 'textarea';
}

interface SelectFieldProps extends BaseFieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  as: 'select';
  children: ReactNode;
}

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function FormField(props: FormFieldProps) {
  const { label, id, className, as = 'input', ...rest } = props;

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {as === 'textarea' ? (
        <textarea id={id} className={styles.input} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : as === 'select' ? (
        <select id={id} className={styles.input} {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}>
          {(props as SelectFieldProps).children}
        </select>
      ) : (
        <input id={id} className={styles.input} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}

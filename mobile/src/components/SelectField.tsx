import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useColors, useThemedStyles, type ThemeColors } from '../lib/colors';

export interface SelectOption<T extends string> {
  readonly key: T;
  readonly label: string;
}

interface SelectFieldProps<T extends string> {
  /** Currently selected option key. */
  readonly value: T;
  /** The options to choose from, in display order. */
  readonly options: readonly SelectOption<T>[];
  /** Called with the chosen key when the user picks an option. */
  readonly onChange: (key: T) => void;
  /** Heading shown at the top of the choice sheet. */
  readonly title?: string;
  /** Accessibility label for the closed field (e.g. "Calculation method"). */
  readonly accessibilityLabel?: string;
}

/**
 * A dropdown-style single-choice selector: a tappable field showing the current
 * value that opens a themed modal list of options. Built on a plain `Modal`
 * (no native picker dependency) so it follows the app's light/dark theme and
 * works across platforms. For long option lists the sheet scrolls.
 */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  title,
  accessibilityLabel,
}: SelectFieldProps<T>) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.key === value);

  return (
    <>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: selected?.label }}
      >
        <Text style={styles.fieldValue} numberOfLines={1}>
          {selected?.label ?? value}
        </Text>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {/* Backdrop tap closes; the inner sheet swallows the press. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {options.map((option) => {
                const isSelected = option.key === value;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => {
                      onChange(option.key);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={c.brand} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    fieldValue: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    sheet: {
      alignSelf: 'stretch',
      maxHeight: '70%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    sheetTitle: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: colors.textMuted,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    sheetScroll: {
      flexGrow: 0,
    },
    sheetContent: {
      paddingVertical: 4,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    optionSelected: {
      backgroundColor: colors.brandTint,
    },
    optionLabel: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    optionLabelSelected: {
      fontWeight: '700',
      color: colors.brand,
    },
  });

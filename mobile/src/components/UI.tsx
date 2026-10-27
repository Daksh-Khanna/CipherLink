import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
  type TextInputProps,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, styles } from '../theme';
export function Button({
  title,
  onPress,
  loading,
  secondary,
  danger,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 35 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        disabled={loading || disabled}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={{
          minHeight: 54,
          borderRadius: 17,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 14,
          backgroundColor: danger ? colors.danger : secondary ? colors.surface : colors.accent,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: secondary ? colors.text : colors.bg }}
          >
            {title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
export function IconButton({
  name,
  onPress,
  label,
  active,
  danger,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: danger ? colors.danger : active ? colors.accent : colors.surface,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Ionicons name={name} size={22} color={danger || active ? colors.bg : colors.text} />
    </Pressable>
  );
}
export function Avatar({
  name,
  size = 52,
  online,
}: {
  name: string;
  size?: number;
  online?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        backgroundColor: '#24453E',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.accent, fontSize: size * 0.33, fontWeight: '700' }}>
        {name
          .split(' ')
          .map((s) => s[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </Text>
      {online && (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: colors.accent,
            borderColor: colors.bg,
            borderWidth: 3,
          }}
        />
      )}
    </View>
  );
}
export const Field = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor={colors.muted}
    selectionColor={colors.accent}
    autoCapitalize="none"
    style={styles.input}
    {...props}
  />
);
export const ErrorText = ({ text }: { text: string }) =>
  text ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {text}
    </Text>
  ) : null;
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={{ paddingVertical: 54, gap: 14, alignItems: 'center' }}>
      <Ionicons name="chatbubbles-outline" size={42} color={colors.accent} />
      <Text style={{ ...styles.body, fontWeight: '700', fontSize: 20 }}>{title}</Text>
      <Text style={{ ...styles.subtitle, textAlign: 'center' }}>{detail}</Text>
    </View>
  );
}

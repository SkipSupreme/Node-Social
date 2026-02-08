import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { RADIUS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';

// TipTap JSON types
interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

interface TipTapContentProps {
  content: TipTapDoc;
  style?: StyleProp<ViewStyle>;
  onMentionPress?: (userId: string) => void;
}

export const TipTapContent: React.FC<TipTapContentProps> = ({
  content,
  style,
  onMentionPress,
}) => {
  const theme = useAppTheme();

  if (!content || !content.content) {
    return null;
  }

  const renderNode = (node: TipTapNode, index: number, isNested = false): React.ReactNode => {
    switch (node.type) {
      case 'paragraph':
        return (
          <Text key={index} style={[styles.paragraph, { color: theme.text }, isNested && styles.nestedParagraph]}>
            {node.content?.map((child, i) => renderNode(child, i, true))}
          </Text>
        );

      case 'heading': {
        const level = node.attrs?.level || 1;
        const headingStyle = level === 1 ? styles.heading1 : level === 2 ? styles.heading2 : styles.heading3;
        return (
          <Text key={index} style={[headingStyle, { color: theme.text }]}>
            {node.content?.map((child, i) => renderNode(child, i, true))}
          </Text>
        );
      }

      case 'bulletList':
        return (
          <View key={index} style={styles.list}>
            {node.content?.map((child, i) => renderNode(child, i))}
          </View>
        );

      case 'orderedList':
        return (
          <View key={index} style={styles.list}>
            {node.content?.map((child, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.listNumber, { color: theme.muted }]}>{i + 1}.</Text>
                <View style={styles.listItemContent}>
                  {child.content?.map((c, ci) => renderNode(c, ci, true))}
                </View>
              </View>
            ))}
          </View>
        );

      case 'listItem':
        return (
          <View key={index} style={styles.listItem}>
            <Text style={[styles.bullet, { color: theme.muted }]}>•</Text>
            <View style={styles.listItemContent}>
              {node.content?.map((child, i) => renderNode(child, i, true))}
            </View>
          </View>
        );

      case 'blockquote':
        return (
          <View key={index} style={[styles.blockquote, { borderLeftColor: theme.accent }]}>
            {node.content?.map((child, i) => renderNode(child, i, true))}
          </View>
        );

      case 'codeBlock':
        return (
          <View key={index} style={[styles.codeBlock, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <Text style={[styles.codeBlockText, { color: theme.text }]}>
              {node.content?.map((child, i) => renderNode(child, i, true))}
            </Text>
          </View>
        );

      case 'horizontalRule':
        return <View key={index} style={[styles.horizontalRule, { backgroundColor: theme.border }]} />;

      case 'hardBreak':
        return <Text key={index}>{'\n'}</Text>;

      case 'image': {
        const src = node.attrs?.src as string | undefined;
        const alt = node.attrs?.alt as string | undefined;
        if (!src) return null;
        return (
          <Image
            key={index}
            source={{ uri: src }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={alt}
          />
        );
      }

      case 'mention': {
        const id = node.attrs?.id as string | undefined;
        const label = node.attrs?.label as string | undefined;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => id && onMentionPress?.(id)}
            disabled={!onMentionPress}
          >
            <Text style={[styles.mention, { color: theme.accent }]}>@{label}</Text>
          </TouchableOpacity>
        );
      }

      case 'text':
        return renderTextWithMarks(node, index);

      default:
        // Unknown node type, try to render children
        if (node.content) {
          return node.content.map((child, i) => renderNode(child, i, true));
        }
        return null;
    }
  };

  const renderTextWithMarks = (node: TipTapNode, index: number) => {
    if (!node.text) return null;

    let textStyle: TextStyle[] = [styles.text, { color: theme.text }];
    let onPress: (() => void) | undefined;
    let linkUrl: string | undefined;

    node.marks?.forEach(mark => {
      switch (mark.type) {
        case 'bold':
          textStyle.push(styles.bold);
          break;
        case 'italic':
          textStyle.push(styles.italic);
          break;
        case 'strike':
          textStyle.push(styles.strike);
          break;
        case 'code':
          textStyle.push(styles.inlineCode);
          textStyle.push({ color: theme.accent });
          break;
        case 'link':
          textStyle.push(styles.link);
          textStyle.push({ color: theme.accent });
          linkUrl = mark.attrs?.href as string | undefined;
          break;
      }
    });

    if (linkUrl) {
      const url = linkUrl;
      onPress = () => Linking.openURL(url);
      return (
        <Text key={index} style={textStyle} onPress={onPress}>
          {node.text}
        </Text>
      );
    }

    return <Text key={index} style={textStyle}>{node.text}</Text>;
  };

  return (
    <View style={style}>
      {content.content.map((node, i) => renderNode(node, i))}
    </View>
  );
};

const styles = StyleSheet.create({
  // Text styles
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  link: {
    textDecorationLine: 'underline',
  },

  // Block styles
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  nestedParagraph: {
    marginBottom: 0,
  },

  // Headings
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },
  heading3: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },

  // Lists
  list: {
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  listItemContent: {
    flex: 1,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    marginRight: 8,
    width: 16,
  },
  listNumber: {
    fontSize: 15,
    lineHeight: 22,
    marginRight: 8,
    width: 20,
  },

  // Blockquote
  blockquote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginVertical: 8,
    opacity: 0.9,
  },

  // Code block
  codeBlock: {
    borderRadius: RADIUS.md,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },

  // Horizontal rule
  horizontalRule: {
    height: 1,
    marginVertical: 16,
  },

  // Image
  image: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.md,
    marginVertical: 8,
  },

  // Mention
  mention: {
    fontWeight: '500',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});

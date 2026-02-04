import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../../constants/theme';

// TipTap JSON types
interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
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
  style?: any;
  onMentionPress?: (userId: string) => void;
}

export const TipTapContent: React.FC<TipTapContentProps> = ({
  content,
  style,
  onMentionPress,
}) => {
  if (!content || !content.content) {
    return null;
  }

  const renderNode = (node: TipTapNode, index: number, isNested = false): React.ReactNode => {
    switch (node.type) {
      case 'paragraph':
        return (
          <Text key={index} style={[styles.paragraph, isNested && styles.nestedParagraph]}>
            {node.content?.map((child, i) => renderNode(child, i, true))}
          </Text>
        );

      case 'heading': {
        const level = node.attrs?.level || 1;
        const headingStyle = level === 1 ? styles.heading1 : level === 2 ? styles.heading2 : styles.heading3;
        return (
          <Text key={index} style={headingStyle}>
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
                <Text style={styles.listNumber}>{i + 1}.</Text>
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
            <Text style={styles.bullet}>•</Text>
            <View style={styles.listItemContent}>
              {node.content?.map((child, i) => renderNode(child, i, true))}
            </View>
          </View>
        );

      case 'blockquote':
        return (
          <View key={index} style={styles.blockquote}>
            {node.content?.map((child, i) => renderNode(child, i, true))}
          </View>
        );

      case 'codeBlock':
        return (
          <View key={index} style={styles.codeBlock}>
            <Text style={styles.codeBlockText}>
              {node.content?.map((child, i) => renderNode(child, i, true))}
            </Text>
          </View>
        );

      case 'horizontalRule':
        return <View key={index} style={styles.horizontalRule} />;

      case 'hardBreak':
        return <Text key={index}>{'\n'}</Text>;

      case 'image': {
        const src = node.attrs?.src;
        const alt = node.attrs?.alt;
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
        const id = node.attrs?.id;
        const label = node.attrs?.label;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => onMentionPress?.(id)}
            disabled={!onMentionPress}
          >
            <Text style={styles.mention}>@{label}</Text>
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

    let textStyle: any[] = [styles.text];
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
          break;
        case 'link':
          textStyle.push(styles.link);
          linkUrl = mark.attrs?.href;
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
    color: COLORS.node.text,
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
    color: COLORS.node.accent,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  link: {
    color: COLORS.node.accent,
    textDecorationLine: 'underline',
  },

  // Block styles
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.node.text,
    marginBottom: 12,
  },
  nestedParagraph: {
    marginBottom: 0,
  },

  // Headings
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.node.text,
    marginBottom: 12,
    marginTop: 4,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.node.text,
    marginBottom: 10,
    marginTop: 4,
  },
  heading3: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.node.text,
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
    color: COLORS.node.muted,
    marginRight: 8,
    width: 16,
  },
  listNumber: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.node.muted,
    marginRight: 8,
    width: 20,
  },

  // Blockquote
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.node.accent,
    paddingLeft: 12,
    marginVertical: 8,
    opacity: 0.9,
  },

  // Code block
  codeBlock: {
    backgroundColor: COLORS.node.panel,
    borderRadius: RADIUS.md,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.node.text,
  },

  // Horizontal rule
  horizontalRule: {
    height: 1,
    backgroundColor: COLORS.node.border,
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
    color: COLORS.node.accent,
    fontWeight: '500',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});

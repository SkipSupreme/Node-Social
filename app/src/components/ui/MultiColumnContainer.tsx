// Multi-column TweetDeck-style feed container for desktop/tablet
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { COLUMNS } from '../../constants/theme';
import { useColumnsStore, FeedColumn as FeedColumnType } from '../../store/columns';
import { FeedColumn } from './FeedColumn';
import { AddColumnModal } from './AddColumnModal';
import { ExternalPost, Node, AuthResponse } from '../../lib/api';
import { useAppTheme } from '../../hooks/useTheme';

type CurrentUser = AuthResponse['user'];

interface MultiColumnContainerProps {
  currentUser: CurrentUser | null;
  nodes: Node[];
  globalNodeId?: string;
  onPostClick: (postId: string) => void;
  onAuthorClick: (authorId: string) => void;
  onUserClick: (userId: string) => void;
  onPostAction: (postId: string, action: string) => void;
  onSaveToggle: (postId: string, saved: boolean) => void;
  onNodeClick?: (nodeId: string) => void;
  showAddModal: boolean;
  onCloseAddModal: () => void;
  onQuoteExternalPost?: (post: ExternalPost) => void;
  onSaveExternalPost?: (post: ExternalPost) => void;
  onEdit?: (post: import('./Feed').UIPost) => void;
}

export const MultiColumnContainer: React.FC<MultiColumnContainerProps> = ({
  currentUser,
  nodes,
  globalNodeId,
  onPostClick,
  onAuthorClick,
  onUserClick,
  onPostAction,
  onSaveToggle,
  onNodeClick,
  showAddModal,
  onCloseAddModal,
  onQuoteExternalPost,
  onSaveExternalPost,
  onEdit,
}) => {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { columns, addColumn, removeColumn, reorderColumns, updateColumn } = useColumnsStore();

  const maxColumns = COLUMNS.getMaxColumns(width);

  const handleAddColumn = (column: Omit<FeedColumnType, 'id'>) => {
    addColumn(column);
    onCloseAddModal();
  };

  const handleMoveLeft = (index: number) => {
    if (index > 0) {
      reorderColumns(index, index - 1);
    }
  };

  const handleMoveRight = (index: number) => {
    if (index < columns.length - 1) {
      reorderColumns(index, index + 1);
    }
  };

  // Info-type columns (node-info, trending) are narrower
  const isNarrowColumn = (type: string) => type === 'node-info' || type === 'trending';
  const NARROW_COLUMN_WIDTH = 280;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Columns Row - flex layout, no horizontal scroll */}
      <View style={styles.columnsRow}>
        {columns.map((column, index) => (
          <View
            key={column.id}
            style={[
              styles.columnWrapper,
              { marginLeft: index === 0 ? 0 : 1 }, // Minimal gap between columns
              // Narrow columns get fixed width, others get flex
              isNarrowColumn(column.type)
                ? { flex: 0, width: NARROW_COLUMN_WIDTH, minWidth: NARROW_COLUMN_WIDTH }
                : { flex: 1 }
            ]}
          >
            <FeedColumn
              column={column}
              currentUser={currentUser}
              nodes={nodes}
              globalNodeId={globalNodeId}
              onPostClick={onPostClick}
              onAuthorClick={onAuthorClick}
              onUserClick={onUserClick}
              onPostAction={onPostAction}
              onSaveToggle={onSaveToggle}
              onRemove={() => removeColumn(column.id)}
              canRemove={columns.length > 1}
              onNodeClick={onNodeClick}
              onMoveLeft={index > 0 ? () => handleMoveLeft(index) : undefined}
              onMoveRight={index < columns.length - 1 ? () => handleMoveRight(index) : undefined}
              onUpdateColumn={(updates) => updateColumn(column.id, updates)}
              onQuoteExternalPost={onQuoteExternalPost}
              onSaveExternalPost={onSaveExternalPost}
              onEdit={onEdit}
            />
          </View>
        ))}

      </View>

      {/* Add Column Modal */}
      <AddColumnModal
        visible={showAddModal}
        onClose={onCloseAddModal}
        onAdd={handleAddColumn}
        nodes={nodes}
        existingColumns={columns}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  columnsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  columnWrapper: {
    minWidth: COLUMNS.minWidth,
  },
});

export default MultiColumnContainer;

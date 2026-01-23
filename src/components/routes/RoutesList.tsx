// components/routes/RoutesList.tsx
import React, { memo, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';

interface Route {
    id: string;
    name: string;
    grade?: string;
    [key: string]: any;
}

interface RoutesListProps {
    routes: Route[];
    refreshing?: boolean;
    onRefresh?: () => void;
    onRoutePress?: (route: Route) => void;
    selectedRouteId?: string;
}

/**
 * רשימת מסלולים (FlatList) - מקבלת רק מסלולים נראים
 */
const RoutesList = memo<RoutesListProps>(({
    routes,
    refreshing = false,
    onRefresh,
    onRoutePress,
    selectedRouteId
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    
    const renderRoute = ({ item: route }: { item: Route }) => (
        <TouchableOpacity
            style={[
                styles.routeItem,
                selectedRouteId === route.id && styles.selectedRoute
            ]}
            onPress={() => onRoutePress?.(route)}
            accessibilityLabel={`מסלול ${route.name}`}
        >
            <View style={styles.routeInfo}>
                <Text style={styles.routeName}>{route.name}</Text>
                {route.grade && (
                    <Text style={styles.routeGrade}>{route.grade}</Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const keyExtractor = (route: Route) => route.id;

    const getItemLayout = (_: any, index: number) => ({
        length: 60,
        offset: 60 * index,
        index,
    });

    return (
        <View style={styles.container}>
            <FlatList
                data={routes}
                renderItem={renderRoute}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                refreshControl={
                    onRefresh ? (
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme.primary]}
                        />
                    ) : undefined
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
});

RoutesList.displayName = 'RoutesList';

// Dynamic styles factory for theme support
const createStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    listContent: {
        paddingVertical: 8,
    },
    routeItem: {
        height: 60,
        marginHorizontal: 12,
        marginVertical: 4,
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 12,
        justifyContent: 'center',
        elevation: 1,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    selectedRoute: {
        backgroundColor: theme.primary + '20',
        borderWidth: 1,
        borderColor: theme.primary,
    },
    routeInfo: {
        flex: 1,
    },
    routeName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 4,
    },
    routeGrade: {
        fontSize: 14,
        color: theme.textSecondary,
    },
});

export default RoutesList;

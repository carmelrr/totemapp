import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useUserRouteStatus } from '@/hooks/useUserRouteStatus';
import { useFirebaseRoutes } from '@/features/routes-map/hooks/useFirebaseRoutes';

interface DayActivity {
  date: string;
  routes: number;
  attempts: number;
  sends: number;
  flashes: number;
  projects: number;
  grades: string[];
}

/**
 * רכיב פעילות יומית בסגנון TopLogger
 * מציג לוח חודשי של פעילות טיפוס
 */
export default function ActivityHeatmap() {
  const { userRouteData } = useUserRouteStatus();
  const { routes } = useFirebaseRoutes();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // יצירת נתוני פעילות חודשיים
  const monthData = useMemo((): DayActivity[] => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    
    const days: DayActivity[] = [];
    
    // הוסף ימים ריקים לתחילת החודש
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: '',
        routes: 0,
        attempts: 0,
        sends: 0,
        flashes: 0,
        projects: 0,
        grades: [],
      });
    }
    
    // הוסף את ימי החודש
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // חשב פעילות ליום זה (סימולציה - בפועל נקבל מ-Firebase)
      const dayActivity = calculateDayActivity(dateStr);
      
      days.push({
        date: dateStr,
        routes: dayActivity.routes,
        attempts: dayActivity.attempts,
        sends: dayActivity.sends,
        flashes: dayActivity.flashes,
        projects: dayActivity.projects,
        grades: dayActivity.grades,
      });
    }
    
    return days;
  }, [selectedMonth, selectedYear]);

  // פונקציה לחישוב פעילות יומית (סימולציה)
  const calculateDayActivity = (date: string) => {
    // בפועל נשלוף נתונים מ-Firebase על בסיס תאריכים
    // כרגע נציג נתונים אקראיים לדמו
    const random = Math.random();
    const hasActivity = random > 0.7; // 30% סיכוי לפעילות
    
    if (!hasActivity) {
      return { routes: 0, attempts: 0, sends: 0, flashes: 0, projects: 0, grades: [] };
    }
    
    const routesCount = Math.floor(random * 8) + 1;
    const sendsCount = Math.floor(routesCount * (0.3 + random * 0.4));
    const flashesCount = Math.floor(sendsCount * (random * 0.3));
    const projectsCount = routesCount - sendsCount;
    
    return {
      routes: routesCount,
      attempts: routesCount + Math.floor(random * 5),
      sends: sendsCount,
      flashes: flashesCount,
      projects: projectsCount,
      grades: ['6a', '6b', '7a'].slice(0, Math.floor(random * 3) + 1),
    };
  };

  // קבלת צבע לפעילות יומית
  const getActivityColor = (activity: DayActivity) => {
    if (activity.routes === 0) return '#f3f4f6';
    if (activity.routes <= 2) return '#dcfce7';
    if (activity.routes <= 4) return '#bbf7d0';
    if (activity.routes <= 6) return '#86efac';
    return '#22c55e';
  };

  // רכיב יום יחיד
  const DayCell = ({ activity, index }: { activity: DayActivity; index: number }) => {
    const dayOfMonth = activity.date ? new Date(activity.date).getDate() : '';
    
    return (
      <TouchableOpacity
        style={[
          styles.dayCell,
          { backgroundColor: getActivityColor(activity) },
          activity.date === '' && styles.emptyDay,
        ]}
        onPress={() => activity.date && console.log('Selected day:', activity.date)}
        disabled={!activity.date}
      >
        <Text style={[
          styles.dayText,
          activity.routes > 0 && styles.activeDayText
        ]}>
          {dayOfMonth}
        </Text>
        {activity.routes > 0 && (
          <Text style={styles.routeCount}>
            {activity.routes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // כותרות ימי השבוע
  const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  // חישוב סטטיסטיקות חודשיות
  const monthStats = useMemo(() => {
    const validDays = monthData.filter(d => d.date !== '');
    const totalRoutes = validDays.reduce((sum, d) => sum + d.routes, 0);
    const totalSends = validDays.reduce((sum, d) => sum + d.sends, 0);
    const activeDays = validDays.filter(d => d.routes > 0).length;
    
    return {
      totalRoutes,
      totalSends,
      activeDays,
      averagePerDay: activeDays > 0 ? totalRoutes / activeDays : 0,
    };
  }, [monthData]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* כותרת ובחירת חודש */}
      <View style={styles.header}>
        <View style={styles.monthSelector}>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
          >
            <Text style={styles.monthButtonText}>‹</Text>
          </TouchableOpacity>
          
          <Text style={styles.monthTitle}>
            {monthNames[selectedMonth]} {selectedYear}
          </Text>
          
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => {
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
          >
            <Text style={styles.monthButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* סטטיסטיקות חודשיות */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.totalRoutes}</Text>
          <Text style={styles.statLabel}>מסלולים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.totalSends}</Text>
          <Text style={styles.statLabel}>שליחות</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.activeDays}</Text>
          <Text style={styles.statLabel}>ימי פעילות</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.averagePerDay.toFixed(1)}</Text>
          <Text style={styles.statLabel}>ממוצע יומי</Text>
        </View>
      </View>

      {/* לוח החודש */}
      <View style={styles.calendar}>
        {/* כותרות ימי שבוע */}
        <View style={styles.weekHeader}>
          {weekDays.map(day => (
            <Text key={day} style={styles.weekDayLabel}>{day}</Text>
          ))}
        </View>

        {/* רשת הימים */}
        <View style={styles.daysGrid}>
          {monthData.map((activity, index) => (
            <DayCell key={index} activity={activity} index={index} />
          ))}
        </View>
      </View>

      {/* מקרא */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>רמת פעילות:</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#f3f4f6' }]} />
            <Text style={styles.legendText}>אין</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#dcfce7' }]} />
            <Text style={styles.legendText}>מעט</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#bbf7d0' }]} />
            <Text style={styles.legendText}>בינוני</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#86efac' }]} />
            <Text style={styles.legendText}>הרבה</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>מקסימום</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  calendar: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    borderRadius: 6,
    margin: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyDay: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeDayText: {
    color: '#111827',
  },
  routeCount: {
    fontSize: 8,
    color: '#059669',
    fontWeight: 'bold',
    marginTop: 2,
  },
  legend: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  legendText: {
    fontSize: 10,
    color: '#6b7280',
  },
});

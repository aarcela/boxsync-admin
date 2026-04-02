export const translations = {
  en: {
    // Auth / Login
    'Staff Email': 'Staff Email',
    Password: 'Password',
    'Access Dashboard': 'Access Dashboard',
    'Verifying...': 'Verifying...',
    'Authorized personnel only. IP address is being logged.': 'Authorized personnel only. IP address is being logged.',
    'Command Center': 'Command Center',
    'Unauthorized: Staff access only.': 'Unauthorized: Staff access only.',
    'No user found': 'No user found',

    // Sidebar
    Overview: 'Overview',
    Attendance: 'Attendance',
    Financials: 'Financials',
    Insights: 'Insights',
    Athletes: 'Athletes',
    Schedule: 'Schedule',
    'WOD Editor': 'WOD Editor',
    News: 'News',
    Feedback: 'Feedback',
    'Log Out': 'Log Out',

    // Feedback Page
    'Coach Feedback': 'Coach Feedback',
    'Review ratings and comments from athletes.': 'Review ratings and comments from athletes.',
    'Search comments...': 'Search comments...',
    All: 'All',
    'All Feedback': 'All Feedback',
    'Avg Rating': 'Avg Rating',
    'No feedback found.': 'No feedback found.',
    Athlete: 'Athlete',
    'Coach:': 'Coach:',
    'No comment provided.': 'No comment provided.',
    Class: 'Class',
    'N/A': 'N/A',
    Anonymous: 'Anonymous',
    'Showing {{count}} of {{total}} entries': 'Showing {{count}} of {{total}} entries',

    // Misc
    Admin: 'Admin',
    English: 'English',
    Spanish: 'Spanish'
  },
  es: {
    // Auth / Login
    'Staff Email': 'Email del Personal',
    Password: 'Contraseña',
    'Access Dashboard': 'Acceder al Tablero',
    'Verifying...': 'Verificando...',
    'Authorized personnel only. IP address is being logged.': 'Solo personal autorizado. La dirección IP está siendo registrada.',
    'Command Center': 'Centro de Mando',
    'Unauthorized: Staff access only.': 'No autorizado: Solo acceso al personal.',
    'No user found': 'Usuario no encontrado',

    // Sidebar
    Overview: 'Resumen',
    Attendance: 'Asistencia',
    Financials: 'Finanzas',
    Insights: 'Análisis',
    Athletes: 'Atletas',
    Schedule: 'Horario',
    'WOD Editor': 'Editor WOD',
    News: 'Noticias',
    Feedback: 'Comentarios',
    'Log Out': 'Cerrar Sesión',

    // Feedback Page
    'Coach Feedback': 'Comentarios de Coaches',
    'Review ratings and comments from athletes.': 'Revisión de calificaciones y comentarios de atletas.',
    'Search comments...': 'Buscar comentarios...',
    All: 'Todos',
    'All Feedback': 'Todos los Comentarios',
    'Avg Rating': 'Calificación Promedio',
    'No feedback found.': 'No se encontraron comentarios.',
    Athlete: 'Atleta',
    'Coach:': 'Coach:',
    'No comment provided.': 'No se proporcionó ningún comentario.',
    Class: 'Clase',
    'N/A': 'N/A',
    Anonymous: 'Anónimo',
    'Showing {{count}} of {{total}} entries': 'Mostrando {{count}} de {{total}} entradas',

    // Misc
    Admin: 'Administrador',
    English: 'Inglés',
    Spanish: 'Español'
  }
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations['en'];

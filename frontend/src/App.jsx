import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from 'motion/react'
import AdminRoute from './components/AdminRoute'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import { AmbientBackground, Loader, pageVariants } from './components/motion'
import { DemoBanner } from './components/ui'
import { AuthProvider } from './context/AuthContext'
import { I18nProvider } from './context/I18nContext'
import { SystemStatusProvider } from './context/SystemStatusContext'

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AnalysisWizardPage = lazy(() => import('./pages/AnalysisWizardPage'))
const ApplicationBoardPage = lazy(() => import('./pages/ApplicationBoardPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const JobSearchPage = lazy(() => import('./pages/JobSearchPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 25, restDelta: 0.001 })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-coral via-leaf to-mint"
      style={{ scaleX }}
    />
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        <Suspense fallback={<Loader />}>
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/inscription" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analyse" element={<AnalysisWizardPage />} />
            <Route path="/offres" element={<JobSearchPage />} />
            <Route path="/comparer" element={<ComparePage />} />
            <Route path="/candidatures" element={<ApplicationBoardPage />} />
            <Route path="/resultats/:id" element={<ResultsPage />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route element={<AdminRoute />}>
              <Route path="/administration" element={<AdminDashboardPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
      <AuthProvider>
      <SystemStatusProvider>
        <BrowserRouter>
          <AmbientBackground />
          <ScrollProgress />
          <div className="relative flex min-h-screen flex-col">
            <DemoBanner />
            <Navbar />
            <main className="flex-1 overflow-x-clip">
              <AnimatedRoutes />
            </main>
            <motion.footer
              className="border-t border-forest/10 py-6 text-center text-xs text-moss"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              ResumeMatch AI · CVisionnaires AI · « Transformez votre CV, visualisez votre avenir. »
            </motion.footer>
          </div>
        </BrowserRouter>
      </SystemStatusProvider>
      </AuthProvider>
      </I18nProvider>
    </MotionConfig>
  )
}

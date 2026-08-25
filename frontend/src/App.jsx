import React, { Suspense, lazy, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import LoadingSpinner from './components/common/LoadingSpinner';
import Layout from './components/layout/Layout';
import {
  RequireAuth,
  RequireApprovedForChurchApp,
} from './components/auth/RouteGuards';
import { getCurrentUser } from './store/slices/authSlice';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EventsList = lazy(() => import('./pages/EventsList'));
const EventForm = lazy(() => import('./pages/EventForm'));
const EventDetails = lazy(() => import('./pages/EventDetails'));
const EventSetlistSongView = lazy(() => import('./pages/EventSetlistSongView'));
const SongList = lazy(() => import('./pages/SongList'));
const SongForm = lazy(() => import('./pages/SongForm'));
const SongDetails = lazy(() => import('./pages/SongDetails'));
const EventChat = lazy(() => import('./pages/EventChat'));
const EventTeamBuild = lazy(() => import('./pages/EventTeamBuild'));
const ProductionPlanning = lazy(() => import('./pages/ProductionPlanning'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const TeamList = lazy(() => import('./pages/TeamList'));
const TeamDetails = lazy(() => import('./pages/TeamDetails'));
const TeamForm = lazy(() => import('./pages/TeamForm'));

function App() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (localStorage.getItem('accessToken')) {
      dispatch(getCurrentUser());
    }
  }, [dispatch]);

  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route element={<RequireAuth />}>
              <Route path="pending-approval" element={<PendingApproval />} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route element={<RequireApprovedForChurchApp />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="events" element={<EventsList />} />
                <Route path="events/new" element={<EventForm />} />
                <Route path="events/:id/team" element={<EventTeamBuild />} />
                <Route
                  path="events/:id/setlist/:songId"
                  element={<EventSetlistSongView />}
                />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="events/:id/chat" element={<EventChat />} />
                <Route
                  path="events/:id/production"
                  element={<ProductionPlanning />}
                />
                <Route path="events/:id/edit" element={<EventForm />} />
                <Route path="teams" element={<TeamList />} />
                <Route path="teams/new" element={<TeamForm />} />
                <Route path="teams/:id" element={<TeamDetails />} />
                <Route path="teams/:id/edit" element={<TeamForm />} />
                <Route path="songs" element={<SongList />} />
                <Route path="songs/new" element={<SongForm />} />
                <Route path="songs/:id" element={<SongDetails />} />
                <Route path="songs/:id/edit" element={<SongForm />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

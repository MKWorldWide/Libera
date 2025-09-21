import React, { ReactNode } from 'react';
import styled from 'styled-components';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = styled.header`
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #2563eb;
`;

const Nav = styled.nav`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const NavButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  color: #64748b;
  cursor: pointer;

  &:hover {
    background: #f8fafc;
    color: #2563eb;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const UserName = styled.span`
  color: #1e293b;
  font-weight: 500;
`;

const Main = styled.main`
  flex: 1;
  overflow: auto;
`;

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header>
        <Logo>Libera</Logo>
        <Nav>
          <NavButton onClick={() => navigate('/dashboard')}>Dashboard</NavButton>
          <NavButton onClick={() => navigate('/alerts')}>Alerts</NavButton>
          <NavButton onClick={() => navigate('/audit')}>Audit</NavButton>
        </Nav>
        <UserInfo>
          <UserName>{user?.firstName || user?.email}</UserName>
          <NavButton onClick={() => navigate('/profile')}>Profile</NavButton>
          <NavButton onClick={logout}>Logout</NavButton>
        </UserInfo>
      </Header>
      <Main>{children}</Main>
    </div>
  );
}

import React from 'react';
import styled from 'styled-components';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

const DashboardContainer = styled.div`
  padding: 2rem;
`;

const WelcomeSection = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  color: #1e293b;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  color: #64748b;
  font-size: 1.125rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled(Card)`
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #2563eb;
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  color: #64748b;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout>
      <DashboardContainer>
        <WelcomeSection>
          <Title>Welcome back, {user?.firstName || user?.email}</Title>
          <Subtitle>Justice Safeguard Assistant - Protecting Due Process</Subtitle>
        </WelcomeSection>

        <StatsGrid>
          <StatCard>
            <StatNumber>0</StatNumber>
            <StatLabel>Active Cases</StatLabel>
          </StatCard>
          <StatCard>
            <StatNumber>0</StatNumber>
            <StatLabel>Pending Alerts</StatLabel>
          </StatCard>
          <StatCard>
            <StatNumber>0</StatNumber>
            <StatLabel>Evidence Items</StatLabel>
          </StatCard>
        </StatsGrid>

        <QuickActions>
          <Button onClick={() => navigate('/cases/new')}>
            Create New Case
          </Button>
          <Button onClick={() => navigate('/alerts')}>
            View Alerts
          </Button>
          <Button onClick={() => navigate('/audit')}>
            Audit Log
          </Button>
        </QuickActions>
      </DashboardContainer>
    </Layout>
  );
}

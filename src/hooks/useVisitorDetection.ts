import { useCallback } from 'react';
import type { Worker, AccessLog } from '@/types/supabase';

export interface VisitorInfo {
  isVisitor: boolean;
  visitorType: 'regular' | 'visitor' | 'unknown';
  company: string;
  role: string;
}

export const useVisitorDetection = () => {
  /**
   * Determines if a worker is a visitor based on various criteria
   */
  const detectVisitor = useCallback((worker: Partial<Worker>): VisitorInfo => {
    const role = worker.role?.toLowerCase() || '';
    const hasCompany = !!worker.company_id;
    
    // Check explicit visitor role
    if (role.includes('visitante') || role.includes('visitor')) {
      return {
        isVisitor: true,
        visitorType: 'visitor',
        company: 'Visitante',
        role: worker.role || 'Visitante'
      };
    }

    // Has company and valid role - not a visitor
    if (hasCompany && role && role !== 'não informado') {
      return {
        isVisitor: false,
        visitorType: 'regular',
        company: 'Empresa',
        role: worker.role || 'Não informado'
      };
    }

    // No company or role - unknown/visitor
    if (!hasCompany) {
      return {
        isVisitor: true,
        visitorType: 'unknown',
        company: 'Empresa não informada',
        role: worker.role || 'Não informado'
      };
    }

    return {
      isVisitor: false,
      visitorType: 'regular',
      company: 'Empresa',
      role: worker.role || 'Não informado'
    };
  }, []);

  /**
   * Determines visitor status from an access log entry
   */
  const detectVisitorFromLog = useCallback((log: AccessLog): VisitorInfo => {
    const workerName = log.worker_name?.toLowerCase() || '';
    
    // Check if name indicates visitor
    if (workerName.includes('visitante') || workerName.includes('visitor')) {
      return {
        isVisitor: true,
        visitorType: 'visitor',
        company: 'Visitante',
        role: 'Visitante'
      };
    }

    // If no worker_id, likely a visitor or unregistered
    if (!log.worker_id) {
      return {
        isVisitor: true,
        visitorType: 'unknown',
        company: 'Não identificado',
        role: 'Não informado'
      };
    }

    return {
      isVisitor: false,
      visitorType: 'regular',
      company: 'Empresa',
      role: 'Trabalhador'
    };
  }, []);

  /**
   * Parse visitor observations for company and role info
   */
  const parseVisitorObservations = useCallback((observations: string): { company: string; role: string } => {
    if (!observations) {
      return { company: 'Visitante', role: 'Visitante' };
    }

    const lines = observations.split('\n').map(line => line.trim()).filter(Boolean);
    
    return {
      company: lines[0] || 'Visitante',
      role: lines[1] || 'Visitante'
    };
  }, []);

  return {
    detectVisitor,
    detectVisitorFromLog,
    parseVisitorObservations
  };
};

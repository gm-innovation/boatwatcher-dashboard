// Tipos de documento conhecidos (para regras de validade)
export const KNOWN_DOCUMENT_TYPES = ['ASO', 'NR10', 'NR33', 'NR34', 'NR35', 'RG', 'CPF', 'CNH'] as const;

// Validade padrão em dias para cada tipo de documento conhecido
export const DEFAULT_VALIDITY_DAYS: Record<string, number | null> = {
  ASO: 365,
  NR10: 730,
  NR33: 365,
  NR34: 730,
  NR35: 730,
  RG: null,
  CPF: null,
  CNH: 1825,
};

// Parsear data em vários formatos
export const parseDocumentDate = (dateString: string | undefined | null): string | null => {
  if (!dateString) return null;
  
  const cleaned = String(dateString).trim();
  
  // Formato ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Formato BR: DD/MM/YYYY
  const brMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Formato BR sem separador: DDMMYYYY
  if (/^\d{8}$/.test(cleaned)) {
    const day = cleaned.slice(0, 2);
    const month = cleaned.slice(2, 4);
    const year = cleaned.slice(4, 8);
    return `${year}-${month}-${day}`;
  }
  
  // Tentar Date.parse como último recurso
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignorar erros
  }
  
  return null;
};

// Calcular data de validade baseada na data de emissão e tipo de documento
export const calculateExpiryDate = (
  issueDate: string | null, 
  documentType: string
): string | null => {
  if (!issueDate) return null;
  
  const typeUpper = documentType.toUpperCase();
  const validityDays = DEFAULT_VALIDITY_DAYS[typeUpper] ?? null;
  if (!validityDays) return null;
  
  try {
    const issue = new Date(issueDate);
    issue.setDate(issue.getDate() + validityDays);
    return issue.toISOString().split('T')[0];
  } catch {
    return null;
  }
};

// Verificar status de validade do documento
export type ValidityStatus = 'valid' | 'expiring_soon' | 'expired';

export const getValidityStatus = (expiryDate: string | null | undefined): ValidityStatus => {
  if (!expiryDate) return 'valid';
  
  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'expiring_soon';
    return 'valid';
  } catch {
    return 'valid';
  }
};

// Calcular dias até o vencimento
export const getDaysUntilExpiry = (expiryDate: string | null | undefined): number | null => {
  if (!expiryDate) return null;
  
  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

// Normalizar gênero
export const normalizeGender = (gender: string | undefined | null): 'Masculino' | 'Feminino' | null => {
  if (!gender) return null;
  
  const genderLower = String(gender).toLowerCase().trim();
  
  if (genderLower === 'm' || genderLower.includes('masc')) {
    return 'Masculino';
  }
  if (genderLower === 'f' || genderLower.includes('fem')) {
    return 'Feminino';
  }
  
  return null;
};

// Formatar CPF para exibição
export const formatCPF = (cpf: string | undefined | null): string => {
  if (!cpf) return '';
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Limpar CPF (apenas números)
export const cleanCPF = (cpf: string | undefined | null): string => {
  if (!cpf) return '';
  return String(cpf).replace(/\D/g, '');
};

// Verificar se um tipo de documento é uma foto
export const isPhotoDocument = (type: string): boolean => {
  const lower = type.toLowerCase();
  return lower.includes('foto') || lower.includes('selfie') || lower.includes('3x4') || lower.includes('retrato');
};

// Prioridade de documento para preenchimento de dados pessoais
// ASO > RG/CNH/CPF > NRs > Outros
export const getDocumentPriority = (type: string): number => {
  const upper = type.toUpperCase();
  if (upper.includes('ASO') || upper.includes('ATESTADO')) return 100;
  if (upper === 'RG' || upper.includes('IDENTIDADE')) return 80;
  if (upper === 'CNH' || upper.includes('HABILITACAO')) return 75;
  if (upper === 'CPF') return 70;
  if (upper.startsWith('NR')) return 30;
  if (isPhotoDocument(type)) return 0;
  return 20;
};

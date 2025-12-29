// Tipos de documento suportados
export type DocumentType = 'ASO' | 'NR10' | 'NR33' | 'NR35' | 'RG' | 'CPF' | 'CNH' | 'Outros';

// Validade padrão em dias para cada tipo de documento
export const DEFAULT_VALIDITY_DAYS: Record<DocumentType, number | null> = {
  ASO: 365,      // 1 ano
  NR10: 730,     // 2 anos
  NR33: 365,     // 1 ano
  NR35: 730,     // 2 anos
  RG: null,      // Não expira
  CPF: null,     // Não expira
  CNH: 1825,     // 5 anos
  Outros: 365,   // 1 ano por padrão
};

// Identificar tipo de documento pelo nome do arquivo
export const identifyDocumentType = (filename: string): DocumentType => {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.includes('aso') || lowerName.includes('atestado') || lowerName.includes('saude')) {
    return 'ASO';
  }
  if (lowerName.includes('nr10') || lowerName.includes('nr-10') || lowerName.includes('eletric')) {
    return 'NR10';
  }
  if (lowerName.includes('nr33') || lowerName.includes('nr-33') || lowerName.includes('confin')) {
    return 'NR33';
  }
  if (lowerName.includes('nr35') || lowerName.includes('nr-35') || lowerName.includes('altura')) {
    return 'NR35';
  }
  if (lowerName.includes('rg') || lowerName.includes('identidade')) {
    return 'RG';
  }
  if (lowerName.includes('cpf')) {
    return 'CPF';
  }
  if (lowerName.includes('cnh') || lowerName.includes('habilitacao') || lowerName.includes('carteira')) {
    return 'CNH';
  }
  
  return 'Outros';
};

// Normalizar tipo de documento da IA
export const normalizeDocumentType = (type: string | undefined): DocumentType => {
  if (!type) return 'Outros';
  
  const typeUpper = String(type).toUpperCase().trim();
  
  if (typeUpper.includes('ASO') || typeUpper.includes('ATESTADO')) return 'ASO';
  if (typeUpper.includes('NR10') || typeUpper.includes('NR-10')) return 'NR10';
  if (typeUpper.includes('NR33') || typeUpper.includes('NR-33')) return 'NR33';
  if (typeUpper.includes('NR35') || typeUpper.includes('NR-35')) return 'NR35';
  if (typeUpper === 'RG' || typeUpper.includes('IDENTIDADE')) return 'RG';
  if (typeUpper === 'CPF') return 'CPF';
  if (typeUpper === 'CNH' || typeUpper.includes('HABILITACAO')) return 'CNH';
  
  return 'Outros';
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
  documentType: DocumentType
): string | null => {
  if (!issueDate) return null;
  
  const validityDays = DEFAULT_VALIDITY_DAYS[documentType];
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
  if (!expiryDate) return 'valid'; // Se não tem validade, considera válido
  
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

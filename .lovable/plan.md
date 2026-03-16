
Objetivo: fazer o modal de edição do trabalhador exibir a foto já cadastrada no avatar grande ao abrir, e continuar atualizando o preview imediatamente após trocar a imagem.

O que confirmei
- No modal de edição (`WorkerManagement.tsx` → `WorkerForm`), o estado inicial do preview usa `worker?.photo_url` cru.
- Como `worker-photos` é privado, esse valor pode ser `storage://...` e não renderiza diretamente em `AvatarImage`.
- Já existe a infraestrutura correta para resolver isso:
  - `src/hooks/useResolvedUrl.ts`
  - `src/components/ResolvedAvatar.tsx`
- Portanto, o problema do preview inicial é de resolução da URL privada no formulário de edição.

O que vou implementar
1. Resolver a foto existente ao abrir o modal
- Usar `useResolvedUrl(worker?.photo_url)` dentro de `WorkerForm`.
- Inicializar/sincronizar `photoPreview` com a URL resolvida, não com `worker.photo_url` bruto.

2. Preservar o comportamento após trocar a foto
- Manter o `FileReader` para que a nova imagem escolhida substitua imediatamente a anterior no preview.
- Garantir que a sincronização da foto existente não sobrescreva a nova prévia local depois da seleção.

3. Ajustar a UI do avatar grande
- Fazer o avatar grande do modal usar sempre `photoPreview` resolvido/local.
- Manter fallback com ícone quando não houver foto cadastrada.

4. Revisar consistência do modal de edição
- Validar que abrir/fechar o modal com trabalhadores diferentes reseta corretamente o preview.
- Garantir que, se o trabalhador já tiver foto, ela apareça automaticamente sem interação.

Arquivos principais
- `src/components/workers/WorkerManagement.tsx`
- apoio já existente:
  - `src/hooks/useResolvedUrl.ts`
  - `src/components/ResolvedAvatar.tsx`

Resultado esperado
- Ao abrir o modal de edição, a foto já cadastrada aparece no avatar grande.
- Ao escolher uma nova foto, o preview troca imediatamente.
- O modal continua compatível com bucket privado, sem expor fotos publicamente.

Detalhe técnico
A correção ideal é sincronizar `photoPreview` a partir da URL resolvida com `useEffect`, usando a foto resolvida apenas enquanto nenhuma nova `photoFile` tiver sido escolhida. Assim o preview inicial funciona e a troca manual continua prioritária.

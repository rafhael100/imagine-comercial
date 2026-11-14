# F211 — Rotação segura de chave pública na revisão CMS offline

A revisão de **duas** publicações assinadas pode atravessar a troca de chave Ed25519 do futuro publicador Portal. O comando `node scripts/review-signed-catalog-transition.mjs` continua somente **leitura e revisão**, com `canPublish:false`, sem conexão externa ou segredo privado.

São obrigatórios os seis parâmetros existentes de envelopes e pins (`IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE`, `IMAGINE_REVIEW_NEXT_ENVELOPE_FILE`, `IMAGINE_REVIEW_PREVIOUS_RELEASE_ID`, `IMAGINE_REVIEW_PREVIOUS_PAYLOAD_SHA256`, `IMAGINE_REVIEW_NEXT_RELEASE_ID`, `IMAGINE_REVIEW_NEXT_PAYLOAD_SHA256`).

Escolher **exatamente um** modo de confiança:

- *Legado*: `IMAGINE_REVIEW_PUBLIC_KEY_FILE` + `IMAGINE_REVIEW_TRUSTED_KEY_ID`; ambas as versões usam a mesma chave pública.
- *Rotação*: `IMAGINE_REVIEW_PREVIOUS_PUBLIC_KEY_FILE` + `IMAGINE_REVIEW_PREVIOUS_TRUSTED_KEY_ID` e `IMAGINE_REVIEW_NEXT_PUBLIC_KEY_FILE` + `IMAGINE_REVIEW_NEXT_TRUSTED_KEY_ID`. Os IDs precisam ser diferentes; cada envelope deve validar sua assinatura com a chave correspondente.

Configurações incompletas ou misturadas, IDs repetidos, envelope adulterado, PEM errado, arquivo inseguro/symlink ou pin inválido falham fechados. Não registrar caminhos, conteúdo, release IDs ou material PEM nos logs. **Somente chaves públicas**, jamais chaves privadas, e nunca commitá-las de clientes no Git.

O teste F211 executa subprocessos reais com duas assinaturas Ed25519 sintéticas, cenários positivos e negativos, mantendo o gate de SEO e versionamento F202/F209. Isto não demonstra permissão Portal, IAM, gestão de chaves em produção ou autorização de publicação. Staging privado, AppSec/DBA/LGPD e aceite de release continuam pendentes.

-- Backup de chamados_adm_fluxos (cadastros GERAIS, classe '') ANTES da limpeza
-- de 10/11/2026. Projeto bogsuuhrgvopzgcceoqz.
--
-- O que eram: a carga de supabase_seed_administrativo_gerente_org.sql (GER PHD
-- do org.xlsx, ago/2026) — 120 linhas, uma etapa só por pessoa, o gerente da
-- planilha. Como o cadastro tem precedência absoluta em `cabecaDaCadeia`
-- (src/modules/administrativo/lib/chamados.js), com ele o organograma nem era
-- consultado: 58 pessoas pulavam o coordenador, 25 paravam nele sem chegar ao
-- gerente, e 10 tinham gerente diferente do organograma do portal.
--
-- A regra que vale a partir de agora, em TODOS os serviços do Atendimento que
-- exigem aprovação: escada do organograma (superior direto e, se ele não for
-- gerência, o primeiro gerente acima dele), mais a faixa de valor nos serviços
-- com gasto. Decisão do Lennon em 10/11/2026.
--
-- Ficou de fora da limpeza a única exceção POR CLASSE (classe 'compra').
--
-- Para restaurar tudo como estava, rode o insert abaixo. Todas as linhas tinham
-- exatamente um aprovador. Checksum do conjunto (md5 de
-- string_agg(solicitante_id || ':' || aprovadores[1], ',' order by solicitante_id)):
-- 4702152a9052a30158eaf9af2b72430a

insert into public.chamados_adm_fluxos (solicitante_id, classe, aprovadores, updated_at)
select v.solicitante_id::uuid, '', array[v.aprovador_id::uuid], now()
from (values
('08f3fcea-3979-4a9a-b220-a805c499dce1', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('0b4d676d-db37-44a9-ac41-7087e8f9209a', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('0b65fd2b-6413-43be-b205-30532d845782', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('0dcb49ff-e896-45ea-845a-6ed55f01f96c', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('0ffde612-657f-4900-a0b6-412dce51ff4a', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('11629252-b5d0-4f34-b9ff-474cd43664ed', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('12ee4508-8cc9-4211-897d-4ef53837a305', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('131b0b87-e3dd-4618-be9c-b31b02cf8808', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('14b53c3f-8465-4e2e-b995-8cec2fa728ae', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('15392a5a-3a09-4345-9282-5b9321d46e7f', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('15b4ea86-44de-4937-9624-7cd4a997ab0a', '554ec9c1-c4fb-4b5a-b4a6-040c835acca5'),
('1be8cd65-152c-4fa7-8391-8d70aa0766f4', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('1c06ed49-b8d1-4a6e-b249-534291e3e0d6', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('1c0b84ba-ec40-41d5-b3f7-6b76d38d0e25', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('1fcbca63-e33e-45b1-9ae7-3fe1e0bf5e60', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('20b2d3ef-871e-4dd0-8241-0dc1bb0802c4', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('22fa54c4-2170-4946-a00b-57eec37d27d7', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('23e11519-905f-4294-bf43-b8c19ce7ef25', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('265afb76-810a-4604-a8a9-31d1a8389ed7', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('268cc37c-fa9d-436f-8170-090f70ad97da', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('26c8062d-b812-46c3-8b29-27804ffdfbc6', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('26e1f139-2c13-49c5-aea7-2daf3e50aca1', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('26ef0b9b-fee7-482d-90d0-3ee55adf39a1', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('2b3b4675-fdfc-4d8b-94e5-f319bb9892c1', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('2f38c1e9-fe2d-4a85-b67e-46329ca33d2c', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('3300e828-5098-4bd2-b704-32fc089d8525', '554ec9c1-c4fb-4b5a-b4a6-040c835acca5'),
('3a82f980-53b2-47c2-908f-2a10707f9578', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('3c0db541-2e0f-4c64-b876-61f8308a39f2', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('44926f0f-8f9a-4016-a691-1967195834af', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('4561133c-4f38-4840-8279-dea0a15d7d81', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('48f0b8e4-753f-44c7-a88a-679328ab7cb2', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('4b34f6c6-9662-4cd9-a80f-29f60fe61cc0', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('4c79aa0f-20f2-427f-9770-5bea944681d3', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('500e7616-84e5-46d0-acff-82b195d16094', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('50339a3d-af6f-4f77-a060-35bd8a8e304f', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('53ba32eb-389b-46c4-ac8c-e366a94f8eda', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('554ec9c1-c4fb-4b5a-b4a6-040c835acca5', '62275900-e9be-4800-a490-1dc63eb03f9e'),
('572982ce-8dbc-4095-8081-f70b83cca8bb', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('5ba145fa-2088-49eb-9415-71d2fd31e889', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('5e0b6dc4-387b-4a50-801a-710c39d8613c', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('5efdf95e-29da-4314-b69e-d00216878a0e', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('5ff3658e-6b91-4fb3-93c4-52f04f3f79e0', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('631adfb9-3b9d-42c5-8b5c-8ea982681a9c', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('63bb9e20-0348-492a-9440-85a4076d74c4', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('63e3555f-b664-418e-b8c5-abf1784c6901', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('64b3c752-36fe-4a40-8fa7-aaf42f77ff34', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('670af57e-59e1-4e0e-ba22-d16f46d4e596', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('677cc663-e481-41cb-be84-1537284fd6e2', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('67baf407-547d-4a94-8c30-9de37cd719e5', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('67e605a5-8a2e-4bfa-bc32-768a5367661a', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('69684143-cfb3-412d-9b3a-14d9af636833', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('6980a9ef-c3c2-4eb0-8142-9faa531a96cb', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('6a537be5-9cab-406d-85b3-3c215face1ed', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('6c13b1c3-7560-4f49-9afe-d99456731a61', '554ec9c1-c4fb-4b5a-b4a6-040c835acca5'),
('6d13f3f0-7d76-4923-96c5-fb0a68eb2b89', '057a1ee2-8280-4bec-91ac-388175f2f070'),
('6d9c0c64-6128-4930-b39a-994a05ce0aaa', '26e914c2-5057-43a9-9efc-96ca2e4bf88f'),
('6f902631-2594-44ba-be13-061669001d3d', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('7314d8cc-2572-40f3-a8dc-ae3739021679', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('741f0edb-7caa-4bf7-960d-694cea6b1e23', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('7606bcb3-eca9-47e1-9c2c-f99e75000c8f', '26e914c2-5057-43a9-9efc-96ca2e4bf88f'),
('7b36ac66-ca3a-4fb8-978f-0f0af2360245', '26e914c2-5057-43a9-9efc-96ca2e4bf88f'),
('7f6d37d0-f501-4425-9e7c-a89a161717ce', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('805ee848-6f00-47ff-a382-2340ff008825', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('83a27963-4ea7-4b78-9e8e-cac1abfff0d0', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('83de65d2-316e-45c1-802d-5d0e3e83c7b7', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('855611d9-cff3-4913-ba6a-9b9bc0f67daa', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('8639f08f-d939-4db8-a01b-9e3bae926325', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('88350c7a-55af-4967-96eb-8590681f4e3f', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('888774f3-a1ba-4117-9fb3-df1a7be58ec1', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('8b05b8d9-20a4-4ce6-93f8-bfd5b5e592cd', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('9390da90-3fa8-41fe-af40-3873beed4226', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('94435bea-9015-4864-a7e3-c8bf016d7d51', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('95b2a534-7109-412b-b8a7-f9eb13a2fcd7', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('9700d77e-7d7c-4b78-ae21-d3d2166316e2', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('980c7a54-b036-4dbd-b9a2-10683c80a5e1', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('981475a6-a06d-4e09-8dbb-50550d0f60fd', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('9b52859b-fc07-4040-805b-e8142d43da29', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('9b5c4772-0dec-4b05-b093-90176b572699', '057a1ee2-8280-4bec-91ac-388175f2f070'),
('9bf5b12a-439a-4229-b7b5-2c68f0d8c0f2', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('a0bd8125-ce27-4784-8b53-c1573d3dbbaa', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('a4bf56ef-85a0-4982-8845-0dd5097645ae', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('a56addb2-a4e1-457b-8264-16bdd26cf7d9', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('a7b4c9fa-5108-434b-93db-0a4849bdb632', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('a7db286c-d5d3-4956-a142-6113b47533cd', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('a8e90268-c84e-421b-983f-281896f2c9e2', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('a9886ddc-7639-4f32-91d3-a6ef04b52881', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('a9b6d649-cf9d-4c57-b37e-714debdd35f0', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('ac0b09b0-eb78-41bb-9a3d-964e3185ae7c', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('b2bd7eb9-3c13-4e53-8cdf-04d5512ca406', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('c1664858-99c3-4a64-adc3-fedc5cebf4ce', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('c1673aff-8920-4517-bb87-57e62586b110', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('c23e87a4-4822-4610-8985-aa8d28046aaf', '554ec9c1-c4fb-4b5a-b4a6-040c835acca5'),
('c45ce53b-cc05-4ecd-9b47-3e3c24f656e6', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('c4776f17-ee5b-4395-b8f0-2817a21959be', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('c4cce5f9-8f1f-49ed-8ffa-1e45284ed381', '26e914c2-5057-43a9-9efc-96ca2e4bf88f'),
('c73cbea8-73f3-4ced-b8a5-3469c4f1713e', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('c8f41d8c-a6f9-4d48-8a7f-2f504fc9cf49', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('c90dc80e-418f-4958-9108-82217e097917', '26e914c2-5057-43a9-9efc-96ca2e4bf88f'),
('cc90a541-69c1-4020-89bd-2f6c15d4c2b4', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('cd78ca7b-8b4b-4299-a4a2-9c7fd87f1481', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('d268ec30-140f-4b7a-9d44-38ea439bd2b2', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('d711183b-4a9a-4a26-a89d-8d4d2d37fd22', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('d792b433-edf6-452f-bb6a-a33a45217151', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('dadf5d5e-6a2e-4311-992b-f602d1e5d2e3', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('dd1fcdd7-e82e-4bd0-95a4-b62fa507069c', '1f6fda3d-2175-4956-9e1d-205b87796251'),
('deccd3eb-764d-40f0-9e81-e8409f2fd2cb', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('df5f7c49-e707-4389-aef4-17291439da6d', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('e378b975-30ef-470d-acb9-003dacc56300', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('e5733991-93fe-4ad2-bec0-da048b7f0c01', '057a1ee2-8280-4bec-91ac-388175f2f070'),
('e6c86757-4cfb-44bb-985f-e9b14843975c', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('eba7528f-52de-4aa5-9e0f-3bbc64534a74', '0d09456b-16f5-4b8c-a820-24f2de7708a7'),
('f0e7b62f-53eb-49d6-87b1-7df524bc33b2', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('f3acd973-5eae-456d-a07f-0ac01d1b3875', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('f49acdf1-179c-47a1-9ef4-f6e372eb6a9a', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2'),
('f8ae64f5-21c7-4e3d-8370-91f8a94706f4', '56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'),
('f9075f0e-2fd2-4f91-bfaf-0fefb2c4c28f', 'cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'),
('faf82888-c354-4039-b711-4f69f54cbb04', '0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'),
('fb29e44a-bf3a-4d3e-8555-70e98f220d28', '73eb06b9-f073-4843-a446-bbbd1b619c0f'),
('fdb5b4c3-c9b5-4c64-b804-a07b0529eb23', 'f0e7b62f-53eb-49d6-87b1-7df524bc33b2')
) as v(solicitante_id, aprovador_id)
on conflict (solicitante_id, classe)
do update set aprovadores = excluded.aprovadores, updated_at = now();

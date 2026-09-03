Created by 万谦, last modified on 七月 10, 2023

#   [LSC表在线表空间迁移](#lsc表在线表空间迁移)  

JIRA：    [YDBRD-10872](https://jira.yasdb.com/browse/YDBRD-10872)  

##   [1. Overview（概述）](#1-overview概述)  

​    分布式的扩缩容需要单机提供表空间的迁移能力，目前带dataBucket的tablespace迁移能力未适配，需要补齐此能力

表空间迁移语法：



##   [2. Features（功能特性）](#2-features功能特性)  

1. 单机支持带LSC表的表空间在线迁移
1. 分布式支持带LSC表的dataset DN组扩缩容 解决chunk重分配


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult garbageDataPurgeBySpaceId(AnkHandler* handler, CodUint32 spcId);
CodResult dupTableSpace(AnkHandler* handler, BakManager* bakm, TableSpace* spc);
CodResult dupRecvSpaceDataBuckets(AnkHandler* handler, BakManager* bakm);
CodVoid   dupRecvFailCleanDataBuckets(AnkHandler* handler, DupSpaceInfo* spaceInfo);

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

（1）禁止迁移bucket下包含  **非SILO**  类型的slice

（2）若目标结点是主备环境，迁移地址  **需要在convert_path下**

（3）为了避免生成新的slice，迁移期间不允许bulk_load模式导入lsc表

（4）迁移表空间内不允许存在ac

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=95108659](https://conf.yasdb.com/pages/viewpage.action?pageId=95108659)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

表空间迁移流程：



其它内容：

（1）LSC特有系统表的数据迁移，TABXFMR$内的记录需要迁移到目标端

（2）加密bucket的迁移

（3）有关slice的fileId sequence，目标端需要推至最大位置

（4）cache内的lsc scol data数据需要增加spcid进一步标识

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

datafile和databucket的迁移目标路径只能指定一个，所以目标路径所在磁盘空间需要足够（提供一定的计算手段，在实际迁移之前作初步的校验拦截）

## Attachments:

[duplicate_space.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDJhMWFkOWEzMzExZGM3ZjEzIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.bpAi3DCZW7kXiZtstuR2EULVgu2lLDGqJfw5O8PHFeE)

 (image/png)    


[duplicate_space.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDI4OTcwYzJhZjRmNTIwMDllIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.ZKx7Nv59ltnOSBbfnGCpkvov6F-9bR8BhMGf6Mi9M-Q)

 (image/svg+xml)    


[duplicate_space.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDJhMWFkOWEzMzExZGM3ZjE1IiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.7c4EBxJhbF4Viv8novfumlu-01X71NhHav31SiBm9IA)

 (image/png)    


[1684396229545.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDI4OTcwYzJhZjRmNTIwMDlmIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.19IiXHKOLgDOtveYvLvL8jE6Kb44FY2RUqRPJr6QE_E)

 (image/png)    


[1684396986849.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDM4OTcwYzJhZjRmNTIwMGEwIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.kzTGKzgujdPNB0zNwukpgkI95vd2K4fp38_0qWVYqjI)

 (image/png)    


[1684397069336.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDM4OTcwYzJhZjRmNTIwMGExIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.oRlbjs0VKbBnMz9dpZYSENxwqRVVBQ2OFZrcuhos8rE)

 (image/png)    


[duplicate_space.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDNhMWFkOWEzMzExZGM3ZjE2IiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.Y5eSboSWreMBgs7LELnCVJkuT5jVDy8s26Ioy-QWCMM)

 (image/svg+xml)    


[image2023-5-24_10-50-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDNhMWFkOWEzMzExZGM3ZjE3IiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.Cvbicd6CKW8EIicB4BnhxVDgZIlKHWjQE0IcjKFxCqo)

 (image/png)    


[WXWorkLocal_16849280708717.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDNhMWFkOWEzMzExZGM3ZjE4IiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.es4thUsmqJUIjtY2c7Nl6DxjRdskoGeWTLONyfTPmQs)

 (image/png)    


[image2023-5-29_9-27-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDM4OTcwYzJhZjRmNTIwMGEyIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.K7t0bVl6I1lfcGNTnECnfXZMfCzZ0kEVeDphqZqDbnE)

 (image/png)    


[image2023-5-29_9-27-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDM4OTcwYzJhZjRmNTIwMGE0IiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.zS2fkPSySGq2f8As3HIvayPuzURNYbr0beMNylDrF3o)

 (image/png)    


[image2023-5-29_9-28-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDNhMWFkOWEzMzExZGM3ZjFiIiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.QVrfPVh5bs4ftTQNDr5Uqhb30I3eKAt78LykAUKddu4)

 (image/png)    


[image2023-5-29_9-29-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDM4OTcwYzJhZjRmNTIwMGE1IiwicmVmX2lkIjoiNjczOTZiMDI1OTNmOTljOWZmMjM1YzY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjAxLCJleHAiOjE3ODIzNzcwMDF9.eAsdp9mae8xJpXQBTVJ8U2N3KJCPSXxU3WXq90XE02g)

 (image/png)    


## Comments:

|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396b03a1ad9a3311dc7f1c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MDEsImV4cCI6MTc4MjMwMTQwMX0.iJakVGHTbHx3ulYuAP7hQI7uYe4KFCp82gCBWF0MQc4),Posted by wanqian at 五月 24, 2023 20:06|
|---|
|  [](null)  ,2023年5月25日讨论：,（1）扩展  表空间迁移语法，分别指定datafile的目标位置和databucket的目标父目录，若不指定，则bucket创建在目标端的local_fs目录下,（2）spcPurgeSpaces中增加purgeGarbageData处理，  GARBAGE_DATA$新增TS#列，表示属于哪个表空间，并在此列上创建索引,（3）swd中的spaceId不进行使用，打开bucket下的文件句柄时依据表所属space id和bucket id找到bucket，因此需要维护迁移前后interId的一致,（4）sliceMeta文件中的dbid作为校验信息需要保留，在目标端接收时做一下处理（s3类型的bucket下slice文件的修改也只涉及sliceMeta文件）,（5）tabXfmr$内的记录在迁移时需要更新为新的bo（转换结构object id）和id（转换任务的唯一标识），id可以在目标端再次获取,（6）databucket的迁移时候需要保证目标目录为空，失败清理时直接将整个目录删除,（7）ac的迁移只迁移定义，先导出定义，再在源数据库下删除，然后导入定义到目标数据库，异常情况下需要在源数据库重建,Posted by wanqian at 五月 25, 2023 14:27|
|  [](null)  ,SCOL_DELETE_BITMAP$中的lob迁移放到元数据迁移阶段 ,此过程按照：,（1）从源端fetch出一条记录，将除lob外的信息作为head信息发送到目标端,（2）发送此行中的lob,（3）目标端接收此lob写成tempLob,（4）目标端将lob和head信息拼接成row对系统表  进行插入,（5）重复（1）直至迁移表空间中所有记录发送完成,Posted by wanqian at 六月 26, 2023 10:33|

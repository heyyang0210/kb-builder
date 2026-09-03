Created by 林永豪, last modified on 十一月 15, 2023

SR链接：    [YDBRD-22623](https://jira.yasdb.com/browse/YDBRD-22623?src=confmacro)    -  DBLINK的DFX视图添加  完成

#   [YDBRD-22623: Dblink DFX Views Design（DBLINK的DFX视图添加 特性设计）](#ydbrd-22623-dblink-dfx-views-designdblink的dfx视图添加-特性设计)  

##   [1. Overview（概述）](#1-overview概述)  

DBLINK的元数据管理缺乏实时观测手段，需要添加DFX视图进行观测。

##   [2. Features（功能特性）](#2-features功能特性)  

- 现SR计划，基于Yashan的    [视图框架](https://conf.yasdb.com/pages/viewpage.action?pageId=127646968)    添加四个DFX视图。其中单机两个，集群两个。
- 单机：V$DBLINK_OBJ_STAT、V$DBLINK_MEM_STAT
- 集群：GV$DBLINK_OBJ_STAT、V$DBLINK_MEM_STAT


##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外提供接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 支持单机和集群
- 可以观测Yashan->Yashan、Yashan->Oracle两种数据库链接的使用情况


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [DBLINK框架](#dblink框架)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c4aa1ad9a3311dc893d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFXZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxOTEsImV4cCI6MTc4MjMxMDk5MX0.4P6wTYIuKxVMY577MP-Oat-Xma2KTwOLeLB2BgERjaE)

###   [视图FT框架](#视图ft框架)  

-   [视图框架](https://conf.yasdb.com/pages/viewpage.action?pageId=127646968)  
- fixed table支撑 fixed view和fixed gView


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

- V$DBLINK_OBJ_STAT


本视图显示所有database link在沙箱进程yex_server上创建的对象的相关统计信息。

|字段|类型|描述|
|---|---|---|
|EXT_OBJ_ID|INTEGER|对象ID|
|EXT_OBJ_NAME|VARCHAR(64)|对象名称|
|EXT_OBJ_USERID|INTEGER|对象USERID|
|EXT_OBJ_VALID|BOOLEAN|对象是否有效，TRUE表示有效，FALSE表示无效|
|EXT_OBJ_REF|INTEGER|对象被引用的计数值|


- V$DBLINK_MEM_STAT


本视图显示所有database link在沙箱进程yex_server上使用的内存的相关统计信息。

|字段|类型|描述|
|---|---|---|
|EXT_DRIVER_NAME|VARCHAR(64)|驱动名称|
|EXT_CONNECTION_COUNT|INTEGER|驱动上与远程数据库建立连接的数量|
|EXT_CONNECTION_MEMORY|INTEGER|驱动上连接占用内存大小|
|EXT_STATEMENT_MEMORY|INTEGER|驱动上语句执行资源占用内存大小|


- GV$DBLINK_OBJ_STAT


本视图显示所有database link在沙箱进程yex_server上创建的对象的相关统计信息。

|字段|类型|描述|
|---|---|---|
|INST_ID|NUMBER|实例ID|
|EXT_OBJ_ID|INTEGER|对象ID|
|EXT_OBJ_NAME|VARCHAR(64)|对象名称|
|EXT_OBJ_USERID|INTEGER|对象USERID|
|EXT_OBJ_VALID|BOOLEAN|对象是否有效，TRUE表示有效，FALSE表示无效|
|EXT_OBJ_REF|INTEGER|对象被引用的计数值|


- GV$DBLINK_MEM_STAT


本视图显示所有database link在沙箱进程yex_server上使用的内存的相关统计信息。

|字段|类型|描述|
|---|---|---|
|INST_ID|NUMBER|实例ID|
|EXT_DRIVER_NAME|VARCHAR(64)|驱动名称|
|EXT_CONNECTION_COUNT|INTEGER|驱动上与远程数据库建立连接的数量|
|EXT_CONNECTION_MEMORY|INTEGER|驱动上连接占用内存大小|
|EXT_STATEMENT_MEMORY|INTEGER|驱动上语句执行资源占用内存大小|


###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 起单机环境自测
    - create dblink，两个视图都不统计信息
    - insert/delete/update/select table@dblink
        - V$DBLINK_MEM_STAT、GV$DBLINK_MEM_STAT：
            - 初始：固定返回2行。EXT_DRIVER_NAME为各驱动名称（YASHAN/ORACLE）。EXT_DRIVER_INIT为false，EXT_CONNECTION_COUNT、EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值为0。
            - 在语句执行过程中：
                - 若用的是y->y链接，则yashan驱动EXT_DRIVER_INIT初始化置为true，EXT_CONNECTION_COUNT数量增加1，EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值增长
                - 若用的是y->o链接，则oracle驱动EXT_DRIVER_INIT初始化置为true，EXT_CONNECTION_COUNT数量增加1，EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值增长
            - 在语句执行结束后：
                - 若用的是y->y链接，yashan驱动EXT_CONNECTION_COUNT数量减少1。若EXT_CONNECTION_COUNT降为0，则EXT_DRIVER_INIT初始化置为false。EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值下降。若EXT_CONNECTION_COUNT降为0，则此时EXT_CONNECTION_COUNT、EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值降为0。
                - 若用的是y->o链接，oracle驱动EXT_CONNECTION_COUNT数量减少1。若EXT_CONNECTION_COUNT降为0，则EXT_DRIVER_INIT初始化置为false。EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值下降。若EXT_CONNECTION_COUNT降为0，则此时EXT_CONNECTION_COUNT、EXT_CONNECTION_MEMORY和EXT_STATEMENT_MEMORY数值降为0。
        - V$DBLINK_OBJ_STAT、GV$DBLINK_OBJ_STAT：
            - 初始：返回0行。
            - 在语句执行过程中：
                - 生成一个新的而exs object，也就是结果集上会多一行。显示出object的id、name、user id等信息。version为初始默认值0。valid置为true（初始默认值是false）。ref计数值自增1（初始默认值是0）。并发使用情况下ref计数值会自增。
            - 在语句执行结束后：
                - ref计数值自减
    - alter dblink，只用考虑V$DBLINK_OBJ_STAT、GV$DBLINK_OBJ_STAT的变化情况。
        - 如果先前已做过dblink的DML，若exs object还在 exs mngr hash buckets中，valid置为false。当ref计数值降为0时，会释放掉这个exs object，则此时视图上查不到这个exs object，结果集减少一行。
        - 如果先前没做过dblink的DML或者dblink的DML流程已处理完，则视图还是返回0行。
    - drop dblink，只用考虑V$DBLINK_OBJ_STAT、GV$DBLINK_OBJ_STAT的变化情况。
        - 如果先前已做过dblink的DML，若exs object还在 exs mngr hash buckets中，则valid置为false。当ref计数值降为0时，会释放掉这个exs object，则此时视图上查不到这个exs object，结果集减少一行。
        - 如果先前没做过dblink的DML或者dblink的DML流程已处理完，则视图还是返回0行。
- 起集群环境自测
    - 对于每个集群中的实例，可视为单机，与单机情况同理


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

##   [9. 附图](#9-附图)  

## Attachments:

[image2023-11-10_15-34-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDk4OTcwYzJhZjRmNTIwYWM5IiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.nxyKNUhsevJaHWK__VWB5Xjyd4Kx38dVtI4orbryN40)

 (image/png)    


[link1007.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDk4OTcwYzJhZjRmNTIwYWNhIiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.Q9f8MBDgS-XRPRvSxF1vAMMHvJXy7jEW3C1ElFWJJZU)

 (image/png)    


[link1031.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDk4OTcwYzJhZjRmNTIwYWNiIiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.oFSNvD2jtkC4ycju8CNua89yWRd_GXnnX19yHRBYYto)

 (image/jpeg)    


[linkalter.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGFhMWFkOWEzMzExZGM4OTM4IiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.VWIDkVtyVtlIupz8rSBcJkvSbi4B5xDAOUxi0xZBhck)

 (image/jpeg)    


[linkdrop.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGE4OTcwYzJhZjRmNTIwYWNjIiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.vVGLOtpgJnyMmU57A2AxSrj908WSVXBOAmbWaKXxU-g)

 (image/jpeg)    


[image2023-11-7_16-26-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGFhMWFkOWEzMzExZGM4OTM5IiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.35Wpx35UZ1ALkiXCsP6wgzMawqSGJ01w_DLfV6fLZVE)

 (image/png)    


[image2023-11-7_17-57-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGFhMWFkOWEzMzExZGM4OTNiIiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.imanDyPHexX58g3BDA8B2Omnzr1hOWv9cQdFmdtdb3A)

 (image/png)    


[image2023-11-7_17-57-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGE4OTcwYzJhZjRmNTIwYWNlIiwicmVmX2lkIjoiNjczOTZjNDk3MjgyMDZlZmI5MmYxMDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTkxLCJleHAiOjE3ODIzODY1OTF9.pB_r9UweyOw_0jq7M9ZCBSe6BJatFJcqwzjuNDNbClA)

 (image/png)    


## Comments:

|  [](null)  ,新视图，汇总作用：,连接、释放，历史次数情况，是否相等,Posted by linyonghao at 十一月 10, 2023 17:22|
|---|
|  [](null)  ,exs object生成多少个，总量多少个（1024）；,memory用了多少，总共多少,Posted by linyonghao at 十一月 10, 2023 17:30|
|  [](null)  ,版本号说明,Posted by linyonghao at 十一月 10, 2023 17:34|
|  [](null)  ,是否能和第一个视图接在一起,Posted by linyonghao at 十一月 10, 2023 17:44|
|  [](null)  ,前两个视图共用,Posted by linyonghao at 十一月 10, 2023 17:48|
|  [](null)  ,结论：,1. version 说明：alter dblink或者drop dblink时，触发dblink invaliate协议流程，告诉yex_server将link对应的exs object从hash buckets上移除，此时version++。走exs free object时，将version重置为0，加入exs free list。
1. 目前不创建汇总新视图。
1. 考虑到现在exs object生成数量最大值是固定1024，通过v$dblink_obj_stat返回的行数能看出来当前使用的exs object数量和1024之间的比较关系。
1. 观察创建exs link和释放exs link的历史次数，意义不大。因为link创建出来，如果不去alter或drop，就会一直在。统计这些量不必要。
1. yex_server上各驱动占用的memory总和，通过v$dblink_mem_stat也能得出。
1. v$dblink_obj_stat中version字段移除，v$dblink_mem_stat中init字段移除
,Posted by linyonghao at 十一月 14, 2023 10:25|

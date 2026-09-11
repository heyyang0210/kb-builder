Created by 朱松平, last modified on 十二月 14, 2023

#   [OM支持导入yasagent机器csv文件](#om支持导入yasagent机器csv文件)  

SR链接：

  [https://jira.yasdb.com/browse/YDBRD-22233](https://jira.yasdb.com/browse/YDBRD-22233)     (23.2)

  [https://jira.yasdb.com/browse/YDBRD-22836](https://jira.yasdb.com/browse/YDBRD-22836)     (23.1)

##   [1. Overview（概述）](#1-overview概述)  

当前yasboot load导入的csv文件必须和yasom进程在同一台主机上。而实际使用过程中，由于单台机器磁盘存贮容量的限制，csv文件会存放在多台不同主机上。因此，本特性需要支持agent模式，导入部署数据库的所有主机上的csv文件，

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持导入部署数据库的所有主机上的csv文件


##   [3. Interfaces（接口）](#3-interfaces接口)  

  `yasboot load`    命令新增参数

|长参|短参|说明|是否必填|
|---|---|---|---|
|--host-id|无|拆分和导入的csv文件所在主机id，可以通过    `yasboot cluster status`    命令查询|否，默认是当前yasagent进程所在主机|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 导入的csv文件必须在yasom管理的主机(yasagent)上，可以不和执行yasboot命令在同一台主机
- 通过参数-f指定control_file文件必须在执行yasboot命令所在主机


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

略

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.2.1 整体流程](#521-整体流程)  

一键拆分导入总体流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396c5c8970c2af4f520b71/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzOTgsImV4cCI6MTc4MjMxMTE5OH0.1Q1fuUyGpY6Ar5eNno-jYfRPb_TDcTyNN0RtQDTSEAc)

1、校验--host-id参数，获得csv文件所在csvFileHost

--host-id为空，默认为当前主机--host-id不为空，校验其格式，以及是否属于yasom管理的主机

2、--delete是否为true，若是，则删除csvFileHost主机中拆分目录中的干扰csv文件，否则跳过该步骤

3、在csvFileHost主机上，调用yasldr拆分文件

4、--to-local是否为true，若是，跳到步骤5，否则跳到步骤6

5、从csvFileHost主机，将各个节点的拆分csv文件打包并上传到所在机器；然后在节点主机上，调用yasldr本地导入节点

6、在csvFileHost主机上，调用yasldr远程导入节点

###   [5.2.2 异常情况说明](#522-异常情况说明)  

1、执行命令前，yasagent进程异常，yasom无法连接该yasagent；该情况下，无法下发任务

2、执行命令时，yasdb、yasldr进程异常，导致任务失败；该情况下，正在拆分任务或者导入任务会失败，没有执行的等待任务会取消；yasldr的报错会透传到yasboot

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

略

###   [5.4 DFX设计](#54-dfx设计)  

略

###   [5.5 其他](#55-其他)  

略

###   [5.6 参考资料](#56-参考资料)  

略

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

分布式两台主机部署

|序号|用例|说明||
|---|---|---|---|
|1|yasboot load -c yashan -f  load.ctl --split-mode nodepart --host-id host0002|一键拆分并远程导入主机host0002上的csv文件||
|2|yasboot load -c yashan -f  load.ctl --split-mode nodepart --host-id host0002 --to-local|一键拆分并本地导入主机host0002上的csv文件||
|3|yasboot load -c yashan  -f  load.ctl --split-mode nodepart --no-load --host-id host0002|一键拆分主机host0002上的csv文件||
|4|yasboot load -c yashan -s  /home/peter/yasldr/test/splitDir/  --host-id host0002|一键导入主机host0002上已经拆分的csv文件||


相关文件：

1、建表语句，

2、csv文件，

3、ctl文件，

##   [7.资料设计章节](#7资料设计章节)  

略

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

略

## Attachments:

[test.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWJhMWFkOWEzMzExZGM4OWRkIiwicmVmX2lkIjoiNjczOTZjNWI3MjgyMDZlZmI5MmYxMTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzk4LCJleHAiOjE3ODIzODY3OTh9.7LPEE4hwfjDCY7Rj9ZwpofiyWAvP2oSzIQ_HHoElXm0)

 (text/csv)    


[t.ctl](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWM4OTcwYzJhZjRmNTIwYjZmIiwicmVmX2lkIjoiNjczOTZjNWI3MjgyMDZlZmI5MmYxMTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzk4LCJleHAiOjE3ODIzODY3OTh9.C57D9RRftTRpTHOEHWNewhNJeAVcXJXoNIH7RIsyYCw)

 (application/octet-stream)    


[create.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWM4OTcwYzJhZjRmNTIwYjcwIiwicmVmX2lkIjoiNjczOTZjNWI3MjgyMDZlZmI5MmYxMTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzk4LCJleHAiOjE3ODIzODY3OTh9.uXDPv3Bj9QMZFOMPuFjfJl4lIJMmapciQDvsKvOfEa4)

 (application/octet-stream)    


## Comments:

|  [](null)  ,2023/11/9 评审意见,1、--host-id为空时，默认是当前yasagent主机，即认为csv文件在当前主机,Posted by zhusongping at 十一月 09, 2023 15:41|
|---|

Created by 梁桢灏, last modified on 十月 15, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview概述)  

由于目前slice归档存在的问题，进行优化。目前归档存在问题：

1. slice归档大小不纳入归档大小，导致slice归档很大，redo归档很小的情况下，难以触发归档清理（bulkload导入情况下很容易出现）。
1. slice归档跟随redo归档进行清理，但在bulkload情况下，slice所属redo可能很小不转换为归档文件，导致slice归档占用大量磁盘空间释放不了。
1. 为了规避1，2问题，添加了enable_arch_data_ignore_backup配置参数，与当前arch_clean_ignore_mode配置参数割裂。


因此本次设计中，主要针对以上问题进行优化：

1. 将slice大小归纳进归档大小中，从而解决问题1，2。
1. 合并enable_arch_data_ignore_backup与arch_clean_ignore_mode。


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features功能特性)  

- 将slice大小归纳进归档大小中
- 合并enable_arch_data_ignore_backup与arch_clean_ignore_mode。


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow数据结构与流程)  

目前arch与archdata是两个不同线程进行归档清理。自动归档清理情况下，流程如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5fa1ad9a3311dc90ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFBQUFJQUFJQUFBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc3NTQsImV4cCI6MTc4MjMxODU1NH0.UBgw_mGkzIq18tc2zPV4Fp7eYMVG6l049MB-CmCk6vo)

arch归档删除推动lfn，然后archdata使用该lfn进行归档清理。

#### 5.2.1 归档清理流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d5fa1ad9a3311dc90cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFBQUFJQUFJQUFBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc3NTQsImV4cCI6MTc4MjMxODU1NH0.UBgw_mGkzIq18tc2zPV4Fp7eYMVG6l049MB-CmCk6vo)

1.  archdata线程归档清理lfn是否已推（redo归档达到上限进行归档清理，推动归档lfn）
1.     - 归档清理lfn已推，直接进行归档清理，完成本轮归档清理。
    - 归档清理lfn未推，统计归档大小。

1. 统计归档大小，使用archdatamanager上记录的lfn查询系统表中lfn（该记录lfn是上次统计slice归档大小的最大lfn）
1.     - archdatamanager归档统计状态为Init时，把状态刷新为start，并统计系统表中全量slice文件大小并更新。统计结束后，若状态为start，则改为end，并更新查询最大lfn。若状态为init，则不修改。
    - 若状态为end时，系统表中存在比记录查询最大lfn还大的记录，统计这部分slice的大小增量添加到slice归档大小，并刷新更新查询最大lfn。
    - 不存在比记录lfn更大的slice归档记录时，当前归档大小无需刷新。

1.  archdata线程先判断slice归档大小与redo归档是否达到上限。
1.     - 未达上限，完成本轮归档清理。
    - 达到上限，尝试删除redo归档进行归档删除。

1. 调用主动归档清理接口，尝试删除一个redo归档文件。
1.     - redo归档不满足清理条件，完成本轮归档清理。
    - redo归档满足归档清理，删除一个redo归档。
    - redo不存在归档，进行日志切换，尝试生成归档，再尝试删除一个redo归档，若删除失败，完成本轮归档清理。

1. 使用推动的lfn进行归档删除，归档删除结束后把archdatamanager归档统计状态设置为Init。完成本次归档清理。


#### 5.2.2 slice归档统计大小统计

archdata系统表上新增字段size代表文件大小，用于统计slice归档文件的大小。由于archdata数据都从datagarbage中来，因此datagarbag的ctx中记录size大小。

全量统计大小时，archdata线程访问系统表，使用归档清理的lfn，统计大于该lfn的文件大小。

- 删列：只记录列文件大小。
- 删slice：记录删除slice大小.。（包括删列文件大小）
- 删表：记录删除全量的slice大小（包括删列文件大小）


增量同步大小时，通过archdatamanager中记录上次lfn情况，从系统表中查询比该lfn大的记录，并统计大小。

#### 5.2.3 归档统计状态设置

状态从prepare（需要重新统计归档大小）->start（开始统计归档大小）→end（结束统计归档大小）→prepare，归档线程按这个顺序进行变更。

- 起库时，状态为prepare，然后线程启动，开始统计归档大小，状态为start，统计结束后，状态为end。
- 后续增量添加归档时，状态为start，增量统计结束后，状态为end。
- 归档清理结束后， 状态置为prepare（重新统计大小）。
- 手动归档清理与统计并发时，统计开始把状态设为start，当归档清理结束时，将状态设置为prepare，统计结束时，将不设置为end，从而开启新一轮统计。


若用户主动触发归档清理，无论状态处于哪个阶段，都置为prepare，然后重新统计归档大小。之所以这样设计，主要因为：

- 并发触发归档清理时，容易出现两个线程同时删除一个文件，导致统计不准，从而出现一直推归档的问题。
- 当文件添加入归档时，这个添加量大小需要辅助日志进行同步，不然备机无法统计该大小。
- 用户手动删除文件，导致文件统计不准。
- 重启时，内存态记录在增加和删除中存在中间态，统计不准。


因此，当归档清理后，会进行一次重新统计，以准确统计大小，避免出现统计值过大，一直需要日志切换。

#### 5.2.4 归档大小合并

归档大小包括两部分：redo归档与slice归档，arch线程只统计redo归档大小，而archdata线程统计slice与redo一起的大小。在行存情况下，slice大小为0，由arch线程触发归档清理。而存在slice情况下，则主要由archdata线程进行归档清理，推动redo归档与slice归档清理。

合并之后将取消  enable_arch_data_ignore_backup配置项，归档是否可以清理由统一的清理规则进行。并且slice归档清理只会落后redo归档清理，保证后续pitr等特性功能实现前提。

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases自测用例)  

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo遗留问题)  

1. 因为新增归档清理大小，原已有归档为0，暂不统计。
1. 主备之间归档删除触发大小不一致，如果主机设置较大，备机设置较小，备机达到上限后，若slice处于redo中，无法触发日志切换来进行归档清理。
1. 归档大小由于收集，可能会延迟变更。


## Attachments:

[image2024-4-18_11-52-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWY4OTcwYzJhZjRmNTIxMjU5IiwicmVmX2lkIjoiNjczOTZkNWY1OTNmOTljOWZmMjM3YTk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NzU0LCJleHAiOjE3ODIzOTQxNTR9.bpyR5CdnPSsoXDQFm17mA3z1X2JFpej8s_AJ3XbHQ7k)

 (image/png)    


[image2024-4-24_18-15-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWY4OTcwYzJhZjRmNTIxMjVhIiwicmVmX2lkIjoiNjczOTZkNWY1OTNmOTljOWZmMjM3YTk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NzU0LCJleHAiOjE3ODIzOTQxNTR9.nBuPtQ6QJ2lZao0T9r8pg69pXrbHLFkGTveLXD2ZpCU)

 (image/png)    

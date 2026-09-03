Created by 谢锐, last modified on 十二月 12, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview概述)  

IR：    [YDBRD-20532](https://jira.yasdb.com/browse/YDBRD-20532?src=confmacro)    -  LSC表增量同步性能优化  完成

LSC表目前支持的增量导入都是直接写入热数据，存在如下问题：

1，热数据查询性能差，需要转冷再查询

2，导入去重通过insert on duplicate key update实现，存在执行流程长，冷数据定位慢且无法批量化处理等问题。

  


目前在数仓T+N导入场景下，上述矛盾都比较突出。

如卫健委和深圳通场景，都采用datax增量导入，要求导入去重且数据重复度较高，都亟待提升导入性能。

  


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features功能特性)  

  


1，支持load into的批量去重导入

     insert into .. on duplicate key  update(mysql语法)

     insert into .. on fonflict  .. do update (postgresql用法)

     merge into .. using when (oracle)

    从功能上看，只有replace into可以精确的表达插入覆盖老版本的意图，其他命令携带update语法表达的语义比replace更广。

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design详细设计)  

  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture架构)  

  


这里有2个问题，一是如何快速导入并提供查询服务，二是如何高效去重。下面讨论下这2个问题的方案。

#### **5.1.1 增量导入方案**

  


导入方式：

|  
|场景|批量大小|冷热选择|现状|特点|备注|
|---|---|---|---|---|---|---|
|1|CDC 逻辑日志增量导入,  
|含update/delete，小事务，单行|热|已支持|实时性好|  
|
|2|CDC Select增量导入(upsert),通过dataX,Sqoop等插件导入,  
|batch,中等或大批量事务,  
|热|支持,语句内批量，没有事务内攒批能力|1，数据在热slice积攒，不会产生小Slice，但需要转换,2，实时导入少量列update更新性能好,3，去重：热数据primary key有回行能力，在热数据部分命中的冲突可加速delete|  
|
||||冷|不支持|1，没有undo开销，其delete代价低,2，不需要额外转换，但如果slice小合并代价大,3，去重：基于主键回表代价大|StarRock DataX：select → csv → bulkload,在插件实现攒批，然后再写入数据库,  [https://docs.starrocks.io/zh-cn/main/loading/DataX-starrocks-writer](https://docs.starrocks.io/zh-cn/main/loading/DataX-starrocks-writer)  ,  
,通用方案：,select→insert into/replace into→batch commit|
|3|BulkLoad全量导入|bulk，大批量|冷|已支持|  
|  
|


  


  


1，增量导入选择热数据还是冷数据？

**在能提供大事务的前提下，选择冷数据。**

  


2，增量导入语法选择

方案1：使用hint决定导入热数据或冷数据。

            insert /*+ append */ into (orale用法)

           或者 insert /*+ bulkload */ into

方案2：支持load into特殊命令直接写入冷数据

             其他语句仍然走热数据，load into语法直接导冷数据，并且支持事务内自动攒批。

            replace into也有去重语义，load into除了表达去重，同时明确指明是批量导入场景，可以做事务内提交优化。

方案3：支持关闭热数据功能。

            关闭热数据时增量导入时直接导入冷数据，限制实时能力，针对T+N场景。限制update能力(或完善)



** 建议选择方案1 ，其次方案2.**

  


#### **5.1.2 数据去重**

  


|方案|特点|案例|  
|
|---|---|---|---|
|导入去重|基于主键/唯一键去重,维护代价大，导入性能低|StarRock主键加载到内存，可定位具体记录,GaussDB(DWS)|主键全加内存使用上有限制，持久化后困难在于主键维护代价大。|
|异步去重|后台在合并时自动去重，通过排序键,提供命令来主动去重，如未主动执行命令，则需要通过查询来去重|CK|  
|
|查询去重|改造查询语句，通过某些特殊字段按业务要求去重，影响查询性能|CK，GaussDB(DWS)|  
|


  


YashanDB目前方案：

1，导入时主键去重，但未维护冷数据主键变化，更新删除冷数据回表通过key来查询。

      这是基于用户不会大量更新冷数据的假设，但是在卫健委，深圳通场景下都不符合该预期。

  


改进思路

方案1：基于主键去重做性能优化，批量导入下，可以先找出待delete的所有冲突key，然后按照slice分组，在slice分组内按照主键找到所有待删除记录来标记删除。

##   

![](https://pingcode.yasdb.com/atlas/files/public/67396b638970c2af4f520434/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM3OTgsImV4cCI6MTc4MjMwNDU5OH0.OK8u8MmEd6XZdk1oy8DyEnBBJprZrnPS_-8xdD4yVMg)

             性能关键点：

                        1，缓存放不下时，写入主键之前，需要先从Slice文件读取主键+排序键。

                              如排序键与主键没任何关系，产生额外的读取代价

                        2，冲突量大时，内存可能也放不下，需要换入换出。

                        3，Slice内根据排序键来查找。按照排序键将待删除记录排序，利用排序键来批量定位记录，然后再对比主键(或RowId)确定。

                              非排序Slice主键中rowid是准确值，可直接使用。 结合布隆过滤器加速

                        4，主键的批量处理能力，btree无批量处理接口，在外部循环处理。

  


方案2：基于主键去重，维护冷数据主键，支持冷数据主键回行。

             方案1的设计基于冷数据更新极少的情况，但是目前快速转冷以实现高效查询的情况下，冷数据更新量就上来了。

             此方案将代价转移到合并和去重环节，对导入性能影响小。如合并时rowId更新占比过高，可优化为重建主键。



方案3：通过排序键来去重，导入完成后生成Coast Slice。在后台或查询时触发去重，如下图。

  


步骤：1,  写入时直接生成Slice，并完成Slice内排序去重。

           2，写入完成后，通过命令或后台任务触发合并，同时在合并Slice间去重。

           3，与其他已排序Slice基于排序主键去重。

##   

![](https://pingcode.yasdb.com/atlas/files/public/67396b63a1ad9a3311dc82ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM3OTgsImV4cCI6MTc4MjMwNDU5OH0.OK8u8MmEd6XZdk1oy8DyEnBBJprZrnPS_-8xdD4yVMg)

Slice根据其逻辑Id是有序的，去重需根据该顺序来，保留最新数据版本。

  


  


方案对比：

|  
|方案|去重效率|存储空间|并发控制|去重时机|约束|
|---|---|---|---|---|---|---|
|1|导入主键去重|1，主键冲突以及删除代价,2，分区内目标Slice，基于排序键批量查找,3，Slice无法循环时，有额外读取Slice文件开销，冲突的主键+排序键可能内存也放不下，或存在换入换出的情况，极端情况下就演变成Slice内的少量记录遍历。|需维护主键|主键行锁，Slice删除锁(chunk粒度)|1，Slice生成时,2，提交时|1，去重推迟到提交时，则去重的记录版本与提交顺序相关.如不推迟去重，对分区内并发能力有一定影响。|
|2|导入主键去重，主键可会行|1，主键冲突以及删除代价,2，主键支持回行，不必查找，性能更高|需维护主键，存储空间大|主键行锁，Slice删除锁(chunk粒度)|1，Slice生成时|1，后台任务会变慢，大量更新主键。需做好后台任务控制。,2，Slice未经后处理时查询性能可能未达到最优|
|3|后台排序键去重|1，分区内所有Slice，基于排序键批量查找,2，不插入主键，没有主键查找等操作，综合性能或许可做到更好,  
|不用维护主键|分区去重锁|1，后台任务,2，查询时|1，主键是排序键前序列，该约束或影响过滤和压缩效果。,2，去重的记录版本与Slice生成顺序相关。,3，要求按Slice生成序来去重，但是VGD Slice无法确定与Coast Slice的顺序。该方案不适合流式导入场景。|


  


**结论：选择方案2，如特定场景需要后续可考虑支持方案3.**

  


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

  


**SR分解**

|SR主题|说明|时间预估|
|---|---|---|
|支持LOAD into命令，采用bulkload方式导入冷数据。|含单机，分布式,LOAD into支持携带多值,导入性能达到XX|  
|
|支持冷数据insert + delete批量去重|执行流程批量化,去重下导入性能达到XX|  
|
|dataX适配|dataX适配导入语法，并支持大粒度事务|  
|
|  
|  
|  
|


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

  


StarRock参考：    [https://zhuanlan.zhihu.com/p/640463766](https://zhuanlan.zhihu.com/p/640463766)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[23.2方案设计-Page-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNjJhMWFkOWEzMzExZGM4MmE4IiwicmVmX2lkIjoiNjczOTZiNjI3MjgyMDZlZmI5MmYwNTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzNzk4LCJleHAiOjE3ODIzODAxOTh9.tP1MGZngwNkuOeXRmgEy-u6ItX2lYoa5wZyzaLMw9HY)

 (image/png)    


[23.2方案设计-Page-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNjI4OTcwYzJhZjRmNTIwNDMxIiwicmVmX2lkIjoiNjczOTZiNjI3MjgyMDZlZmI5MmYwNTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzNzk4LCJleHAiOjE3ODIzODAxOTh9.dZ137hwfbwdDOlMwI1yyAuoyJcCtVNZHovtFPQibFrI)

 (image/png)    


[23.2设计图-Page-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNjI4OTcwYzJhZjRmNTIwNDMyIiwicmVmX2lkIjoiNjczOTZiNjI3MjgyMDZlZmI5MmYwNTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzNzk4LCJleHAiOjE3ODIzODAxOTh9.3Ip8bwb1sCX_IUjQj6E6E-xqi7ICIXjoDLhmfQEjFSs)

 (image/png)    


[23.2设计图-Page-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNjJhMWFkOWEzMzExZGM4MmE5IiwicmVmX2lkIjoiNjczOTZiNjI3MjgyMDZlZmI5MmYwNTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzNzk4LCJleHAiOjE3ODIzODAxOTh9.W0qP9rF08ApoA1ba0V4Ml0QusGuIttaH3phqvwOzWV0)

 (image/png)    


[23.2设计图-Page-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNjNhMWFkOWEzMzExZGM4MmFhIiwicmVmX2lkIjoiNjczOTZiNjI3MjgyMDZlZmI5MmYwNTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzNzk4LCJleHAiOjE3ODIzODAxOTh9.d_t9ddwzyd0ctKNRw4K-AQxMOcPg0kkoYmPgolAxzjQ)

 (image/png)    


## Comments:

|  [](null)  ,2023.10.11 讨论，李怿，郭藏龙，何金阳，陈宜顺，黄文早，陈晓晴,总结：,1，选择直接导入冷数据方案,2，使用load等特殊命令执行批量导入，replace into等语义不适合bulk load可见性。,3，使用主键去重，后续版本考虑异步去重,  
,Posted by xierui at 十月 11, 2023 18:11|
|---|
|  [](null)  ,建议使用load into，load原本已有load data也是采用bulkload写冷数据。load into是将多个值写入冷数据。,1，已跟陈阳，赵思豪确认dataX可支持更大事务，以及可改造支持load into语法,2，btree除了首次，没法支持批量写入。也不能支持upsert语义，需从表操作触发。,Posted by xierui at 十月 12, 2023 15:24|

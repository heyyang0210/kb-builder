Created by 贺国锋, last modified on 八月 30, 2023

MASTER:      [YDBRD-16790](https://jira.yasdb.com/browse/YDBRD-16790)  

BR22.2:        [YDBRD-19013](https://jira.yasdb.com/browse/YDBRD-19013)  

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#1-overview%E6%A6%82%E8%BF%B0)  

该SR为更详尽的展示SQL loader的导入过程及出现的问题。对于rejected的数据和discard的数据分别写入对应的文件，log文件用于记录导入过程中的具体情况，包括导入了几条数据，数据因为什么rejected等具体信息。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

###   [(1) ERRORS 因为多线程同时工作发送给服务端，服务端并不会因为达到上限而终止，且需要向客户端返回失败了几条，该结果可能不符合errors本义，超出该限制。）**](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#1-errors-%E5%9B%A0%E4%B8%BA%E5%A4%9A%E7%BA%BF%E7%A8%8B%E5%90%8C%E6%97%B6%E5%B7%A5%E4%BD%9C%E5%8F%91%E9%80%81%E7%BB%99%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%9C%8D%E5%8A%A1%E7%AB%AF%E5%B9%B6%E4%B8%8D%E4%BC%9A%E5%9B%A0%E4%B8%BA%E8%BE%BE%E5%88%B0%E4%B8%8A%E9%99%90%E8%80%8C%E7%BB%88%E6%AD%A2%E4%B8%94%E9%9C%80%E8%A6%81%E5%90%91%E5%AE%A2%E6%88%B7%E7%AB%AF%E8%BF%94%E5%9B%9E%E5%A4%B1%E8%B4%A5%E4%BA%86%E5%87%A0%E6%9D%A1%E8%AF%A5%E7%BB%93%E6%9E%9C%E5%8F%AF%E8%83%BD%E4%B8%8D%E7%AC%A6%E5%90%88errors%E6%9C%AC%E4%B9%89%E8%B6%85%E5%87%BA%E8%AF%A5%E9%99%90%E5%88%B6)  

SQL loader的容错个数，当bad文件中的个数达到errors的个数，则会终止程序并退出。

并行场景下，所有线程均可修改该参数，故将该参数挂在loader上，并加锁访问。考虑到错误场景较少，加锁对性能影响较小。

**语法**  ： options(errors = parameter_value), parameter_value的最小值是0，最大值为Uint32，默认为50。

###   [(2) BADFILE](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#2-badfile%E6%B6%89%E5%8F%8A%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%8F%8A%E6%9C%8D%E5%8A%A1%E7%AB%AF)  

**语法**  ： BADFILE directory_path [filename]，目录需用单引号框起，如果指定到文件名，可不带后缀，会补全后缀bad。

**说明**  ：与INFILE的用法一致，不同点在于BADFILE可指定到目录，将在该目录下生成与csv文件同名的后缀为bad的文件，若是已存在该文件，将overwritten

**生成条件**     ：无论是否指定，只要有rejected数据就会生成。（Oracle说指定了才会生成，行为和说法不符）对于一些非法路径，如不存在，不进行报错，  当有rejected数据需要写入时，将之前的内容commit并报错退出  。 

**与Oracle不同**  ：

- 1.Oracle可单独指定文件名，但未见其在INFILE目录下及程序运行目录下生成，故我们不支持该种方式。且Oracle允许多文件情况下BADFILE同名，现象表现为覆盖，建议不允许生成同名的bad文件，若有，考虑到没有rejected数据不生成，故在execute阶段进行判断是否已生成同名文件，是否报错拦截。
- 2.如果指定的bad文件目录不存在，当bad数据存在于csv文件的最后一行时，Oracle会将bad数据前的内容commit并结束导入；当bad数据存在于中间时，对之前成功导入的内容不做commit。sqlldr对此的表现为将bad数据前已导入的内容进行commit，在log文件中记下相关报错并结束导入。
- 3.Oracle支持badfile或discardfile与infile同名，如badfile和infile同名，支持一边导入一边修改infile，infile有两条，多文件导入情况下生成的badfile有两条，后两条导入失败，在log文件中表现为记录3和记录4，我们会进行文件校验，同样是在执行阶段进行。


**何种数据会被放入BADFILE**  ：

- 1.类型转换失败的数据；
- 2.违反约束的数据；
- 3.不符合csv格式的数据。
- 4.未命中分区的数据。


只要被任意一张表reject，将不会插入，并写入bad文件中。如果没有生成bad文件的权限，继续导入但不写文件，  并在log文件中声明  。

**对当前代码的修改**

- 1.由于csv文件中的数据会原模原样的写到badFile中。
- 2.需要修改协议，服务端需要将报错的行号及原因返回。
- 3.对服务端的batchInsert函数进行修改，对于批插失败的数据，需要将错误的语句摘出来继续导入。


###   [(3) DISCARDFILE（仅涉及客户端的binder线程）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#3-discardfile%E4%BB%85%E6%B6%89%E5%8F%8A%E5%AE%A2%E6%88%B7%E7%AB%AF%E7%9A%84binder%E7%BA%BF%E7%A8%8B)  

**语法**  ：discard ::= DISCARDFILE directory_path [filename] [{ DISCARDS | DISCARDMAX } integer]，对于目录的指定方式同badfile，但默认后缀为dsc。

**说明**  ：directory_path部分同BADFILE，后可通过指定discardNum来选择丢弃的上限，达到上限后停止导入。该文件仅涉及客户端，仅用于跳过匹配全为null的情况。

**生成条件**  ：  不指定真的不生成

**与Oracle不同**  ：

- 1.discardNum为1，Oracle会在向文件中写入两条后终止，我们1就是1！
- 2.Oracle文档中说多文件情况下如果只指定了一次discardNum,将会应用于所有文件，实际表现并未如此，如果对于未指定的文件没有上限，我们的表现同Oracle的表现。


**何种数据会被放入DISCARDFILE**  ：

- 1.整行映射均为NULL的数据。


###   [(4) LOG](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#4-log)  

作为options存在，Oracle需要指定到目录或文件名，指定文件用法同file，log作为options中的参数存在，至少指定到文件名，可不带后缀，会补全后缀log。

如果不指定log参数，则在infile目录下生成同名文件，后缀为log

如果无法生成log文件，即没有权限情况下，导入报错终止。

**与Oracle不同**  ：

Oracle在任何场景下都会生成log文件，我们仅在导入申请到足够资源后进行导入。

如何区分阶段：跟csv数据相关报错及insert相关报错有关的均为执行阶段。

###   [(5) SILENT](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#5-silent)  

默认为false。为true表示不生成记录文件，优先级高于LOG参数。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

**1.函数或者表达式特性，要从测试用户或者DBA角度，给出对外接口。**

**2.SQL语法，必须给出EBNF。禁止描述不存在的分支。**

**3.协议、驱动等接口类，必须罗列完全用户可感知的接口函数说明。**

**4.与数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出设计说明。**

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

**从设计、架构、功能内部耦合角度产生的约束，必须给出详细说明，用于支撑测试方案的灰盒测试。**

**结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

**对于BADFILE和DISCARDFILE**  ：

如果识别到有一个文件中存在rejected或discard的数据，根据场景生成badFile或discardFile，不同点在于，即使不声明badFile也会生成badFile，但如果不声明discardFile，将不会生成discardFile

复杂点：对于badFile，跨客户端，服务端；对于discard文件，仅涉及binder线程。

- 1.需要校验，如果infile、badfile、discardfile可能出现同名情况，则报错退出。
- 2.由于是在子线程生成文件，则需要加锁，其他线程如果存在rejected或discard的数据，需等待；
- 4.如果当前用户对文件目录只有读权限没有写权限，commit之前内容并报错退出。


在写入文件的过程中，使用的buffer是挂在csvCtrl上的buffer（来自LargeBlock，大小为2M).

**对于LOG文件**  ：

考虑到性能，log可作为参数，如果指定为true，则生成log文件，否则则不生成。（待定）

若生成log文件，则buffer由decoder线程个数决定。

**对于客户端的修改**

增加信息，记下发往服务端的每条数据对应在csv文件中的offset及size，在客户端返回错误行号及信息后写入到fileBuffer中

**对于服务端的修改**

在批插场景下，分两阶段

- 1.读取数据，构造row或builder，在该过程中，应该只有类型转换报错，记下row上的size，如果出现问题，重新init，继续构造，但需将行号及错误信息记下。
- 2.插入数据，批插场景下，如果是可以允许的失败，则记下行号及错误信息。将该行的前后重新调用batchInsert。新的一批插入行号可能有变化，需要调整行号使得他与原来客户端中发送过来的行号一致。


对于错误信息的返回，需要将行号和msg记到一个链表中返回给客户端，只要有失败，一律返回error；或者可以带着容错信息返回客户端，此时就不需要错误码校验了。

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#51-architecture%E6%9E%B6%E6%9E%84)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

客户端解析工作流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396aec8970c2af4f51ffea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQkFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBZ0lBQUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMDUsImV4cCI6MTc4MjMwMTAwNX0.GH-lCGpBtCTTwHQD57uOWNoUhTv_TwaRUKn8eCoEIuQ)

  


客户端和服务端交互流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396aec8970c2af4f51ffeb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQkFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBZ0lBQUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMDUsImV4cCI6MTc4MjMwMTAwNX0.GH-lCGpBtCTTwHQD57uOWNoUhTv_TwaRUKn8eCoEIuQ)

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#54-dfx%E8%AE%BE%E8%AE%A1)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

调研文档：

  [https://conf.yasdb.com/display/~zhuyueting/BAD+FILE](https://conf.yasdb.com/display/~zhuyueting/BAD+FILE)  

  [https://conf.yasdb.com/display/~zhuyueting/DISCARD+FILE](https://conf.yasdb.com/display/~zhuyueting/DISCARD+FILE)  

  [https://conf.yasdb.com/display/~zhuyueting/LOG+FILE](https://conf.yasdb.com/display/~zhuyueting/LOG+FILE)  

  [https://conf.yasdb.com/display/~zhuyueting/ERRORS](https://conf.yasdb.com/display/~zhuyueting/ERRORS)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=119559470#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments:

[yasldr客户端执行流程.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWM4OTcwYzJhZjRmNTFmZmU3IiwicmVmX2lkIjoiNjczOTZhZWM3MjgyMDZlZmI5MmVmZjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjA1LCJleHAiOjE3ODIzNzY2MDV9.8wq8mT5QDvEfgDTITnOHTs0R7gNRgoqBoUrZd_CdM9o)

 (application/octet-stream)    


[yasldr客户端执行流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWM4OTcwYzJhZjRmNTFmZmU4IiwicmVmX2lkIjoiNjczOTZhZWM3MjgyMDZlZmI5MmVmZjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjA1LCJleHAiOjE3ODIzNzY2MDV9.43hHIOaO9hQxJjsFhGuq_x_PSEpNmvccvDWeWVg7gLc)

 (image/jpeg)    


[客户端服务端交互流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWNhMWFkOWEzMzExZGM3ZTVmIiwicmVmX2lkIjoiNjczOTZhZWM3MjgyMDZlZmI5MmVmZjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjA1LCJleHAiOjE3ODIzNzY2MDV9.ybqgM3FNrod3Svb4ugduQ0lYYXg63WYEx7pliCyY_ps)

 (image/jpeg)    


## Comments:

|  [](null)  ,1、在资料中详细说明error参数的意义，写入bad的条数可能会超过error， ,2、在达到error上线时，如果数据没有导完，需要单独提示用户数据并没有导完，,3、统计信息的变更提单后打印到日志中，不再输出到控制台,4、对于bad和dsc文件，客户端支持相对路径，即支持.开头的,5、SILENT控制都不生成,6、统计信息需要本次合入,  
,遗留问题：,1、error num 这里和oracle不一致，需要和产品对齐。结论：接受，文档说明。默认50写明,2、报错肯定要合入，性能没有明确诉求，连接池不合入。统计信息看工作量，反合范围需要明确,  
,产品需求：,1、报错要跳过继续导入,2、报错的数据要打印出来，放到文件,3、报错的具体信息要打印出来,  
,Posted by heguofeng at 八月 30, 2023 11:17|
|---|

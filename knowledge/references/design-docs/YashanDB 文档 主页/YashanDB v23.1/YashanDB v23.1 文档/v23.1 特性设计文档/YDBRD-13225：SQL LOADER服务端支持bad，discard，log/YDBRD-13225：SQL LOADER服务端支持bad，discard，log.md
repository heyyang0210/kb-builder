Created by 朱月婷 on 七月 17, 2023

  


SR链接：    [https://jira.yasdb.com/browse/YDBRD-13225](https://jira.yasdb.com/browse/YDBRD-13225)  

##   [1. Overview（概述）](#1-overview概述)  

在此之前实现的SQL loader如果导入过程中因为数据格式有问题或者insert过程中出现问题，会直接报错退出，后在外场问题的推动上，新增了位置信息报错，不存在容错机制。

该SR为更详尽的展示SQL loader的导入过程及出现的问题。对于rejected的数据和discard的数据分别写入对应的文件，log文件用于记录导入过程中的具体情况，包括导入了几条数据，数据因为什么rejected等具体信息。

并新增errors参数，定义SQL loader的数据容错上限。

##   [2. Features（功能特性）](#2-features功能特性)  

###   [(1) ERRORS](#1-errors)  

SQL loader的容错个数，当bad文件中的个数达到errors的个数，则会终止程序并退出。

并行场景下，所有线程均可修改该参数，故将该参数挂在loader上，并加锁访问。考虑到错误场景较少，加锁对性能影响较小。

**语法**  ： options(errors = parameter_value), parameter_value的最小值是0，最大值为Uint32，默认为50。

**注**  ：该SR仅支持服务端，故该参数仅在服务端生效，客户端仅语法兼容。如果在存储层报错，将会回滚这一批，且直接退出，不写入badfile中。

###   [(2) BADFILE](#2-badfile)  

**语法**  ： BADFILE directory_path [filename]，目录需用单引号框起，如果指定到文件名，可不带后缀，会补全后缀bad。

**说明**  ：与INFILE的用法可一致，不同点在于BADFILE可指定到目录，将在该目录下生成与csv文件同名的后缀为bad的文件，若是已存在该文件，将overwritten

**生成条件**   ：无论是否指定，只要有rejected数据就会生成。（Oracle说指定了才会生成，行为和说法不符）对于一些非法路径，如不存在，不进行报错，当有rejected数据需要写入时，将之前的内容commit并报错退出。

**与Oracle不同**  ：

- 1.Oracle可单独指定文件名，但未见其在INFILE目录下及程序运行目录下生成，故我们不支持该种方式。且Oracle允许多文件情况下BADFILE同名，现象表现为覆盖，建议不允许生成同名的bad文件，若有，考虑到没有rejected数据不生成，故在execute阶段进行判断是否已生成同名文件，是否报错拦截。
- 2.如果指定的bad文件目录不存在，当bad数据存在于csv文件的最后一行时，Oracle会将bad数据前的内容commit并结束导入；当bad数据存在于中间时，对之前成功导入的内容不做commit。sqlldr对此的表现为将bad数据前已导入的内容进行commit，在log文件中记下相关报错并结束导入。
- 3.Oracle支持badfile或discardfile与infile同名，如badfile和infile同名，支持一边导入一边修改infile，infile有两条，多文件导入情况下生成的badfile有两条，后两条导入失败，在log文件中表现为记录3和记录4，我们会进行文件校验，同样是在执行阶段进行。


**何种数据会被放入BADFILE**  ：

- 1.类型转换失败的数据；
- 2.违反约束的数据；
- 3.不符合csv格式的数据。
- 4.未命中分区的数据。


只要被任意一张表reject，将不会插入，并写入bad文件中。如果没有生成bad文件的权限，继续导入但不写文件，并在log文件中声明。

**注**  ：由于在batchInsert情况下，存储没有容错能力，如果一批中有一条失败，将会回滚这一批，如果这一批的条数超过errors的上限，优先级高于errors参数，即使超过errors也会写入badfile，并将其记到log文件中。

**对当前代码的修改**

- 1.考虑到一条数据只要被一张表拒绝，就不会插入任意表中；需要记下上次成功插入的行的offset，如果已经kernelRowPut的表，恢复插入该行前的offset；将BatchInsert条件放在对每张表都kernelRowPut后。
- 2.多表情况下的判断较复杂，建议单表和多表的逻辑仍然分开。
- 3.由于csv文件中的数据会原模原样的写到badFile中，如果有字段存在转义双引号，在处理时转移双引号会被去除。  **考虑到错误场景为少量场景，在写入badFile时还原。discardFile为同样操作**  。
- 4.由于存储不支持batchInsert情况下容错，故如果因为存储报错导入失败，将把失败原因写入log文件，并终止导入并退出。


###   [(3) DISCARDFILE](#3-discardfile)  

**语法**  ：discard ::= DISCARDFILE directory_path [filename] [{ DISCARDS | DISCARDMAX } integer]，对于目录的指定方式同badfile，但默认后缀为dsc。

**说明**  ：directory_path部分同BADFILE，后可通过指定discardNum来选择丢弃的上限，达到上限后停止导入。

**生成条件**  ：不指定真的不生成

**与Oracle不同**  ：

- 1.discardNum为1，Oracle会在向文件中写入两条后终止，我们1就是1！
- 2.Oracle文档中说多文件情况下如果只指定了一次discardNum,将会应用于所有文件，实际表现并未如此，如果对于未指定的文件没有上限，我们的表现同Oracle的表现。


**何种数据会被放入DISCARDFILE**  ：

- 1.不满足when子句的语句；（只要可以导入任意一张表都不会被写入）
- 2.整行映射均为NULL的数据。


补充说明：如果一行数据存在类型转换等问题，如果满足WHEN子句，则写入BADFILE中；如果不满足，则写入DISCARDFILE中。但如果可以匹配成功，但csv格式存在问题，将直接写入bad文件（与Oracle不同）。

###   [(4) LOG](#4-log)  

作为options存在，Oracle需要指定到目录或文件名，指定文件用法同file，log作为options中的参数存在，至少指定到文件名，可不带后缀，会补全后缀log。

如果不指定log参数，则在当前目录下生成，名称为日期+编号，如果已存在相关文件（考虑并发情况），编号++，类似20230508160801.log。

如果无法生成log文件，即没有权限情况下，导入报错终止。

**注**  ：对于写入到badfile或discardfile中的文件，需要写明数据在原文件中的offset和size及在被写入文件中的offset和size

**与Oracle不同**  ：

Oracle在任何场景下都会生成log文件，我们仅在导入申请到足够资源后进行导入。

如何区分阶段：跟csv数据相关报错及insert相关报错有关的均为执行阶段。

###   [(5) SILENT](#5-silent)  

默认为false。为true表示不生成记录文件，优先级高于LOG参数。

##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

**1.函数或者表达式特性，要从测试用户或者DBA角度，给出对外接口。**

**2.SQL语法，必须给出EBNF。禁止描述不存在的分支。**

**3.协议、驱动等接口类，必须罗列完全用户可感知的接口函数说明。**

**4.与数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出设计说明。**

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

**从设计、架构、功能内部耦合角度产生的约束，必须给出详细说明，用于支撑测试方案的灰盒测试。**

**结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

**对于BADFILE和DISCARDFILE**  ：

如果识别到有一个文件中存在rejected或discard的数据，根据场景生成badFile或discardFile，不同点在于，即使不声明badFile也会生成badFile，但如果不声明discardFile，将不会生成discardFile

复杂点：对于badFile，跨reader线程，decoder线程，未来的binder线程；对于discard文件，仅涉及decoder线程。

- 1.在verify阶段进行校验，多文件情况下，如果大家都生成bad文件，是否存在同路径同名文件，记在标志位fileExists上；
- 2.如果fileExists为COD_TRUE，某文件在生成bad文件前，检查是否已有其他同名文件生成，若有，则将之前的内容commit，并报错退出。若无，则生成文件；
- 3.由于是在子线程生成文件，则需要加锁，其他线程如果存在rejected或discard的数据，需等待；
- 4.如果当前用户对文件目录只有读权限没有写权限，commit之前内容并报错退出。


在写入文件的过程中，使用的buffer是挂在csvCtrl上的buffer（来自LargeBlock，大小为2M).

**对于LOG文件**  ：

考虑到性能，log可作为参数，如果指定为true，则生成log文件，否则则不生成。（待定）

若生成log文件，则buffer由decoder线程个数决定。

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考 **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** ）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考 **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** ）。用于支撑测试方案的灰盒测试。**

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

调研文档：

  [https://conf.yasdb.com/display/~zhuyueting/BAD+FILE](https://conf.yasdb.com/display/~zhuyueting/BAD+FILE)  

  [https://conf.yasdb.com/display/~zhuyueting/DISCARD+FILE](https://conf.yasdb.com/display/~zhuyueting/DISCARD+FILE)  

  [https://conf.yasdb.com/display/~zhuyueting/LOG+FILE](https://conf.yasdb.com/display/~zhuyueting/LOG+FILE)  

  [https://conf.yasdb.com/display/~zhuyueting/ERRORS](https://conf.yasdb.com/display/~zhuyueting/ERRORS)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
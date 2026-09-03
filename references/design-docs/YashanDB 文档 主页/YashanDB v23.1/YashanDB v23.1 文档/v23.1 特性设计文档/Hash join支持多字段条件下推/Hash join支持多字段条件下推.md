Created by 黄靖东, last modified on 十月 31, 2023

#   [列存支持多字段的条件下推](#列存支持多字段的条件下推)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-14150](https://jira.yasdb.com/browse/YDBRD-14150)  

##   [1. Overview（概述）](#1-overview概述)  

本文主要描述分布式TPCH性能特性：列存支持多字段的条件下推。

##   [2. Features（功能特性）](#2-features功能特性)  

(1) 支持多字段的条件下推

##   [3. Interfaces（接口）](#3-interfaces接口)  

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 多字段必现是来源于同一表
1. distinct记录的数量大于1000万行并且开了并行且条件下推需要merge，就不会用条件下推
1. 并不是所有场景下，下推的性能都会变好的，有些情况下性能甚至会变差，取决于bloomfilter的过滤性。
1. 出现分批时，不生成bloom filter
1. AC目前用不上运行时条件下推
1. 执行时条件过滤时，采样10万条记录的的过滤效果，如果过滤性小于0.5 就丢弃运行时条件下推


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

多字段条件下推，就是Hash join build表构建完成之后，会利用条件下推的字段，先计算其hash，利用hash 值构建出来bloomfilter。这个bloomfilter会下推到hash join的左节点上的table scan。tablescan会利用次运行时条件，提前过掉数据。这样就减少了hash join过程中需要在hash tale中探测的次数。

####   [5.1.1 多字段条件下推尽可能利用构建hash table时的hash值](#511-多字段条件下推尽可能利用构建hash-table时的hash值)  

当hash join condition的字段和runtime filter的字段数一样，且字段是一样的，条件下推所使用的hash值就是构建hash table得到的hash值。否则需要在hash table构建完成之后，利用运行时字段构建hash值。当前runtime filter的字段需要修改成tuple，否则执行计算知道runtime filter的字段。

###   [5.2 DFX设计](#52-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.3 其他](#53-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

1. Testcases（自测用例）设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。


自测关注点：

覆盖全面避免重复测试测试用例的可维护性自测用例设计方法：

边界值等价类正交

|场景|
|---|
|多字段作为hash join条件， 两个表进行jion|
|多字段作为hash join条件， 右表为join，左表为普通的join|
|多字段作为hash join条件， 右表为join，左表也为join|
|多字段作为hash join条件， 右表为join，左表也为hash group|


以上场景要叠加并行，分区并行

7.资料设计章节资料在设计阶段，要识别出来相关需要调整的范围、大纲。

1. TODO（遗留问题）说明本方案遗留的问题或下一步需要解决的问题。

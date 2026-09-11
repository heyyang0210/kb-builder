Created by 谭思宇, last modified on 十月 31, 2023

  [YDBRD-13658: 子查询中order by的优化去除](https://jira.yasdb.com/browse/YDBRD-13658)  

  


##   [1. Overview（概述）](#1-overview概述)  

部分子查询场景下order by无意义，可以进行优化。

##   [2. Features（功能特性）](#2-features功能特性)  

子查询场景说明

当前版本将按照较为严格的场景进行设计，除from子查询外的其他位置的子查询，即投影列子查询，in/exists子查询，filter子查询（包括like，any与having），在不含有limit或offset的时候，orderby都不含有实际意义，可被优化去除。

exists在不为关联子查询的时候只要limit大于0即可优化。

限制表格

||from|投影列|in|filter|exists|
|---|---|---|---|---|---|
|优化条件|-|不含limit或offset时可优化|不含limit或offset时可优化|不含limit或offset时可优化|非关联子查询，无offset且limit大于0时即可优化|


##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外接口，在符合上述条件下的子查询中加入orderby即可生效。

在隐藏参数 _RWRT_OPT 中新增标志位，alter session set _RWRT_OPT = 7 即可关闭子查询order by优化，该参数默认值为255

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

本次需求不改写from子查询。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

选择在rewrite阶段进行改写，主要为rewriteOrderBy时判断当前子查询是否符合上述条件，符合时进行删除。

另外需要同时修改parseTree中queryNode里的orderby信息

##   [6. Testcases（自测用例）](#6-testcases自测用例)  
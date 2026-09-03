Created by 马士杰 on 一月 18, 2024

  


#   [YDBRD-14145 : 优化器适配LSC唯一键 Design（XXX方案设计）](#ydbrd-14145--优化器适配lsc唯一键-designxxx方案设计)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-14145](https://jira.yasdb.com/browse/YDBRD-14145)  

##   [1. Overview（概述）](#1-overview概述)  

LSC支持唯一键后，优化器对唯一键进行适配。

##   [2. Features（功能特性）](#2-features功能特性)  

存储已支持lsc唯一键，优化器需要相关适配。主要为lsc表在进行索引扫描时不能进行回表操作，只能进行纯索引扫描。

##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案没有对外暴露的接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

LSC表支持唯一键后可以走索引扫描，但是不能回表，所以如果不是纯索引扫描要将该路径置为非法。

LSC表可能使用的索引扫描包括FULL INDEX SCAN、FAST FULL INDEX SCAN、FULL INDEX SCAN(MIN/MAX)、INDEX RANGE SCAN、INDEX UNIQUE SCAN

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

LSC表已经支持唯一键，指定唯一键之后会自动生成系统索引。但是该索引是不可见的，需要将其置为可见。

transLogiScan2IndexScan时需要判断当前的select能不能走索引，此前只对TAC表有兼容，需要补充LSC的判断，否则无法生成索引扫描计划。

genIndexScanRangeSet中在INDEX_FULL_SCAN和INDEX_FAST_FULL_SCAN分支中对lsc索引的情况进行判断。

根据tableDesc的表类型获得是否时LSC表，只有在是纯索引扫描的时候LSC表可以走索引扫描，否则将当前路径置为非法。

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

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
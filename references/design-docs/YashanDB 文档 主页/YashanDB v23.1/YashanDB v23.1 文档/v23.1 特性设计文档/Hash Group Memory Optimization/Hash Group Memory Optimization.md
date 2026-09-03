Created by 李嘉瑞, last modified on 七月 25, 2023

#   [YDBRD-13176 : Hash Group Memory Optimization Design（Hash group使用内存优化方案设计）](#ydbrd-13176--hash-group-memory-optimization-designhash-group使用内存优化方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-13176](https://jira.yasdb.com/browse/YDBRD-13176)  

##   [1. Overview（概述）](#1-overview概述)  

- 该设计方案是为了当hash group/distinct可用内存小时可以正常执行不报错。


##   [2. Features（功能特性）](#2-features功能特性)  

- 当hash group可用内存不足时，可以正常执行
- 当hash distinct可用内存不足时，可以正常执行


##   [3. Interfaces（接口）](#3-interfaces接口)  

- 暂无


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 该SR可以在小内存场景下减少hash group/distinct使用的内存，但不能保证在任何条件下都能执行成功，需要hash group的可用内存至少不低于一个最小阈值（具体数值待测试，预估可能几M左右）。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 场景一：hash group可用内存不足且所有聚合函数中不带distinct（例如：sum(distinct a)），触发分批后批次元数据占用内存多](#51-场景一hash-group可用内存不足且所有聚合函数中不带distinct例如sumdistinct-a触发分批后批次元数据占用内存多)  

- 该场景需要避免使用太多批次元数据，当分批较多并且需要再次分批时，不再增加批次元数据，新增的批次全部写入原有的最后一批中
- 触发条件：总使用内存超过可用内存阈值并且批次元数据使用内存占比超过一定数值


###   [5.2 场景二：hash group可用内存不足且聚合函数中带distinct（例如：sum(distinct a)）,此时无法触发分批](#52-场景二hash-group可用内存不足且聚合函数中带distinct例如sumdistinct-a此时无法触发分批)  

- 该场景下剩余数据使用sort group，可以节省内存(sort group一次只做一个group，hash group会一次把所有的group都做完)，每在sort group执行完一个group后，在之前的hash group中查找是否有该条数据，如果有就合并


###   [5.3 场景三：场景二中单个group中的数据较多，执行hash distinct时内存不足,或者语句中不含group](#53-场景三场景二中单个group中的数据较多执行hash-distinct时内存不足或者语句中不含group)  

- 该场景原有流程会将hash distinct改为sort distinct，现改为为hash distinct增加一个特殊的分批路径，支持在hash distinct内部分批


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- hash group不带distinct
- hash group带distinct，一个group中distinct数较少
- hash group带distinct，一个group中distinct数较多
- 对于上面三个场景，分别测试带普通聚合函数和不带普通聚合函数的


##   [7.资料设计章节](#7资料设计章节)  

不涉及

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,在切换成sort group之前也可以分批，当切换时需要考虑将分批的数据合并,场景三包含不带group,可以采取不切换成sort group的方式，当有新的column set时，除已有的group以外的数据全部写盘,Posted by lijiarui at 七月 24, 2023 17:46|
|---|

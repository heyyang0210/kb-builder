Created by 王泽凯, last modified by  周湘淞 on 十二月 19, 2023

#   [YDBRD-20439 : 支持多个join order的最优选择](#ydbrd-20439--支持多个join-order的最优选择)  

IR链接：    [YDBRD-20439](https://jira.yasdb.com/browse/YDBRD-20439?src=confmacro)    -  支持多个join order的最优选择  完成

SR链接：    [YDBRD-21717](https://jira.yasdb.com/browse/YDBRD-21717?src=confmacro)    -  支持top10 join order  完成

##   [1. Overview（概述）](#1-overview概述)  

本方案主要在扩宽原有join order的算法，使得能够选择出多个最优的join tree进行物理优化。

##   [2. Features（功能特性）](#2-features功能特性)  

在复杂的join场景下，新的join order算法能够使得选择出来cost更低的计划。

##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外接口。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

现在只放开了10个最优的join tree进行物理优化，如果join的排列组合树超过10个，仍有可能没法选择出最优计划。假设要找出A join B join C的最优join order，A、B、C三个表及join之后的条数如下：

|#A|#B|#C|#(A join B)|#(B join C)|#(A join C)|#(A join B join C)|
|---|---|---|---|---|---|---|
|2|5|6|5|10|20|15|


则在放开topK前，只会保留cost最小的连接，即(A join B)join C，舍去了A join(B join C)和(A join C) join B的分支，最终生成的物理路径只会在这个逻辑顺序的基础上扩展，即使这个逻辑最优不是全局最优的解。比如说，如果最优的路径为A join (B join C)，这种方法是无法取到这个路径的。

![](https://pingcode.yasdb.com/atlas/files/public/67396c87a1ad9a3311dc8b0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFnQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUJBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQkFBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ0FFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBUUFBUUFBQUFJQUFBQUFBZ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEzNzEsImV4cCI6MTc4MjMxMjE3MX0.YyN-ljGTjl7fLZMReaczE41dEIevuhPPJigXyx9M2Y0)

而放开topK之后，假设放开k为2，即最优的2个join order路径都会被保留，在这个例子中，(A join B)join C和A join(B join C)的分支都会被保留，(A join C)的分支被舍去，搜索空间被扩展了，因此能够搜索到全局最优路径的可能性也变大了，但如果最优路径是B join (A join C)，这个例子中仍然会取不到全局最优的路径。

![](https://pingcode.yasdb.com/atlas/files/public/67396c878970c2af4f520c9d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFnQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUJBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQkFBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ0FFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBUUFBUUFBQUFJQUFBQUFBZ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEzNzEsImV4cCI6MTc4MjMxMjE3MX0.YyN-ljGTjl7fLZMReaczE41dEIevuhPPJigXyx9M2Y0)

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

由于本SR在原有join order算法的基础上放开保留的最优连接数目，基本设计和结构沿用原有设计，详细设计可参考    [基于动态规划的Join Order实现](https://conf.yasdb.com/pages/viewpage.action?pageId=76935139)    。引用原设计文档中的概要：

>   当前的join实现是按照两个步骤实现的，  

>   1、根据cardinality，计算k个最佳 join order的集合，  **本SR将k由原先的1放开为10**  。 该部分在joinorder_dp中实现。  

>   2、根据生成的最佳join order集合，选择最佳join算法。join的算法支持与设置在trans_join中实现，join选择在cbo选择最佳计划过程中做为整体成本的一部分被计算在内。  

###   [5.1 Architecture（架构）](#51-architecture架构)  

计算join order的过程中主要结构体的联系如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c87a1ad9a3311dc8b0c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFnQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUJBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQkFBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ0FFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBUUFBUUFBQUFJQUFBQUFBZ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEzNzEsImV4cCI6MTc4MjMxMjE3MX0.YyN-ljGTjl7fLZMReaczE41dEIevuhPPJigXyx9M2Y0)

其中，JoinGraph中有多少个JoinVertex，JoinDpMemo中就会有多少个JoinSubsets，第i个JoinSubsets代表一个有i个表连接的子集。某个特定的连接子集中，前k个最优的join连接顺序被保存在topElems中，k通过结构体BinHeap中的maxElems来指定。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

计算生成topK个join order的主要流程在searchDpTopOrders函数中，函数工作流程如下所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396c87a1ad9a3311dc8b0d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFnQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUJBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQkFBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBZ0FFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBUUFBUUFBQUFJQUFBQUFBZ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEzNzEsImV4cCI6MTc4MjMxMjE3MX0.YyN-ljGTjl7fLZMReaczE41dEIevuhPPJigXyx9M2Y0)

其中负责添加路径到搜索空间的主要计算过程在searchDpJoinOrders函数中完成。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

这个SR自测功能点主要有两点：

1.放开top10后不影响原有正常功能；

2.性能至少不比原来更差，部分场景能够选出比原来更优的计划。性能方面，要通过测试方面测试；

而第一点不影响原有正常功能，自测用例很难全部覆盖，应该通过门禁、二层和测试三方面验证才能基本覆盖

自测使用测试给的冒烟用例和通过门禁

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

按照本SR中只需要保留最后一个JoinSubsets的前k个最优的join顺序，JoinSubsets结构体中BinHeap是不需要的。另外insertBinHeapElem的位置需要调整。

## Attachments:

[image2023-11-1_16-18-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODdhMWFkOWEzMzExZGM4YjA2IiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9.Jiq005uh5qy7YW1fVZ7yjv1TXxKDtj1W0DA4gFajDKM)

 (image/png)    


[image2023-11-1_16-57-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODc4OTcwYzJhZjRmNTIwYzkzIiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9._bZu7CWF2UD9CCUGSuNkARQtoPjhazLrONL0VRnp8Ls)

 (image/png)    


[image2023-11-2_14-20-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODdhMWFkOWEzMzExZGM4YjA3IiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9.jLq1a7q1MiBmW_xNOdCHs4OnYxhODtSQNljMfWHWD4o)

 (image/png)    


[image2023-11-2_14-23-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODc4OTcwYzJhZjRmNTIwYzk4IiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9.AugQ9JPF0OzdpPq7duELF6Dr2ohwaqSl9zBN20iq64U)

 (image/png)    


[image2023-11-2_18-24-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODc4OTcwYzJhZjRmNTIwYzlhIiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9.0nhimdzTS0tgo1n9lk3yQuqAgWgV0ZupCjy-LUrQtOg)

 (image/png)    


[image2023-11-2_18-33-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODdhMWFkOWEzMzExZGM4YjA5IiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9.meyuvg8V63wFC8h1wf8k0Ku0ukzCI5-N5MKqELhby-4)

 (image/png)    


[image2023-11-2_18-34-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODdhMWFkOWEzMzExZGM4YjBhIiwicmVmX2lkIjoiNjczOTZjODc1OTNmOTljOWZmMjM2ZjkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzcxLCJleHAiOjE3ODIzODc3NzF9.tzHCFKzry5ZiUT7ef7L-F0UE3mhN8uhwYCN7tjD_UyM)

 (image/png)    

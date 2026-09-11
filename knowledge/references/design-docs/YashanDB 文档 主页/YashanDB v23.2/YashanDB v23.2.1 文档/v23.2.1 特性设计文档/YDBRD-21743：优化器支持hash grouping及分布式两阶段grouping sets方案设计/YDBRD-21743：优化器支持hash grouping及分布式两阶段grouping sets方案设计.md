Created by 谭思宇, last modified on 十一月 01, 2023

  [YDBRD-21743](https://jira.yasdb.com/browse/YDBRD-21743?src=confmacro)    -  优化器支持hash grouping  完成

##   [1. Overview（概述）](#1-overview概述)  

分布式在支持grouping sets的基础上，为了满足TPC-DS的性能需求，需要实现hash grouping与两阶段grouping，当前列存grouping只实现了sorted grouping与CN全收集。

因此为满足需求，需要增加hash grouping算子与对应的两阶段路径。

##   [2. Features（功能特性）](#2-features功能特性)  

大体特性分为三步

|功能|设计表现|设计说明|
|---|---|---|
|分布式支持grouping sets|放开优化器内对于分布式grouping sets的拦截|放开后可生成CN grouping sets|
|hash grouping|计划中增加hash grouping算子|增加的为物理算子，最终可以体现在计划打印上|
|两阶段grouping|transform过程中增加grouping二阶段逻辑转逻辑|最终可影响物理计划，grouping sets语句可以看到两个grouping或group|


###   [2.1 分布式grouping sets](#21-分布式grouping-sets)  

放开拦截，增加对应grouping sets的CN单节点属性

该部分属于     [YDBRD-22007: 分布式支持rollup](https://jira.yasdb.com/browse/YDBRD-22007)  

###   [2.2 hash grouping](#22-hash-grouping)  

当本身语句中没有order需求或者下方算子提供的数据在无序的场景下时，hash grouping应该在大部分场景下都要优于sorted grouping

具体改动涉及模块：

|模块|改动概述|
|---|---|
|transform|logic -> physic 阶段增加 toPhysHashGrouping分支|
|planner|createGroup增加HASH_GSETS分支及对应枚举|
|explainer|增加hash grouping计划打印|


涉及场景：  **单机列存/分布式列存**

###   [2.3 phase two grouping sets](#23-phase-two-grouping-sets)  

当数据量较多的场景下时，分发的cost占比下降，两阶段cost更低，此时可以选出两阶段grouping sets

|模块|改动概述|
|---|---|
|transform|logic -> logic 阶段增加 toPhase2LogiGroup|


涉及场景：  **分布式**

##   [3. Interfaces（接口）](#3-interfaces接口)  

本需求主要提供的为优化器内部路径，不对外感知，具体函数见下方详细设计。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 放开分布式下grouping sets
- 增加hash grouping算子


优化器无额外规格，其余规格参考执行规格。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

具体划分为以下几个阶段（红框即为本次需要增加的部分）

1. 逻辑转逻辑增加两阶段grouping路径，此处省略了其余路径


![](https://pingcode.yasdb.com/atlas/files/public/67396c47a1ad9a3311dc8918/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQkFBQUNBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFDQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBUUFBQUFBQUFBQUFBQUFBREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFJQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNDYsImV4cCI6MTc4MjMxMDk0Nn0.PCAv3pg25ciPem43xybrsnFg6PaQCQIO-xRWNlwuswg)

    2. 逻辑转物理增加hash grouping分支

![](https://pingcode.yasdb.com/atlas/files/public/67396c478970c2af4f520aab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQkFBQUNBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFDQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBUUFBQUFBQUFBQUFBQUFBREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFJQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNDYsImV4cCI6MTc4MjMxMDk0Nn0.PCAv3pg25ciPem43xybrsnFg6PaQCQIO-xRWNlwuswg)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

本需求重点在于两阶段grouping sets的等价改写，相关等价规则调研见**    [两阶段grouping sets调研](https://conf.yasdb.com/pages/viewpage.action?pageId=133578544)    **

####   [5.2.1 数据结构变动](#521-数据结构变动)  

主要影响为增加grouping sets to phase two group函数及对应枚举

```
typedef enum EnTransformId {
	...

    // Explorer.
	...
    LOGI2GROUPAGGRDIST,
    LOGIADV2GROUPSETS,
	LOGIGROUPSETS2PHASE2, // 此处新增逻辑转逻辑
    LOGIGROUP2PEA4DIST,
    LOGIGROUP2PHASE2,
	...    
} TransformId;

// 加入对应的transform数组中
TransformId gXformLogiGroup[] = {
    LOGIADV2GROUPSETS, LOGIGROUPSETS2PHASE2 /* 加这里 */, LOGI2GROUPAGGRDIST, LOGIGROUP2ACSCAN, LOGIGROUP2PEA4DIST, LOGIGROUP2PHASE2, LOGI2PHYSGROUP,
};


```

其余hash grouping等枚举增加不在此一一列举。

####   [5.2.2 实际逻辑流程](#522-实际逻辑流程)  

#####   [5.2.2.1 logiGrouping2PhaseTwo](#5221-logigrouping2phasetwo)  

红框标注部分为本次新加部分

![](https://pingcode.yasdb.com/atlas/files/public/67396c47a1ad9a3311dc8919/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQkFBQUNBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFDQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBUUFBQUFBQUFBQUFBQUFBREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFJQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNDYsImV4cCI6MTc4MjMxMDk0Nn0.PCAv3pg25ciPem43xybrsnFg6PaQCQIO-xRWNlwuswg)

>   **partial 与 final 拆分阶段**    此时的rollup和cube表达式在经过了transLogiAdvGroup2GroupSets后已经全部展开为grouping sets的形式，因此在后续切分两阶段的处理中直接按照grouping sets进行处理    当aggr函数中不包含distinct时：    1. 一阶段所有聚合函数保持原样，增加隐式grouping函数进入聚合函数中（当本身聚合函数里有符合条件的函数时可以不添加）
  - 增加一个隐式的grouping_id()函数，该函数的参数为grouping sets中出现过的所有不同的表达式，用以在二阶段区分不同的grouping sets子集
- 增加一个隐式的group_id()函数，该函数没有参数，用以在二阶段区分相同的grouping sets子集
  1. 产生的二阶段group为普通的group，而不是grouping，其中的group列需要进行额外处理
  - group列为grouping sets中出现的所有表达式，即 1.中grouping_id()函数的参数
- group列需要在末尾追加1.所添加的聚合函数
    当aggr函数中包含distinct时：    1. 一阶段无法做distinct，将所有distinct列追加到grouping sets所有子集的前面，可去重，其余操作与不包含distinct时操作相同
1. 二阶段将distinct还原
  

---


---


#####   [5.2.2.2 phys增加hash grouping](#5222-phys增加hash-grouping)  

hash grouping由于本身grouping包含多个不同的groupkey，因此其  **必定无法满足任何的hash derive，也无法产生任何的hash require**  ，所以Hash grouping只能require random并且derive random。

此部分可以参考extendGroupRandomPart

- 当grouping为grouping complete时，必定在CN上运行，向下require CN的singleton与parallel的singleton
- 当grouping为grouping partial，必定在DN上运行，向下reuqire DN的random与parallel的random


## Attachments:

[grouping sets.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDdhMWFkOWEzMzExZGM4OTEzIiwicmVmX2lkIjoiNjczOTZjNDc1OTNmOTljOWZmMjM2YzdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTQ2LCJleHAiOjE3ODIzODY1NDZ9.UFzCkOIAZsh_d6Q2fJQcQuj3n64n4xrk5EJyCso9U18)

 (image/png)    


[image2023-10-31_19-55-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDc4OTcwYzJhZjRmNTIwYWE5IiwicmVmX2lkIjoiNjczOTZjNDc1OTNmOTljOWZmMjM2YzdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTQ2LCJleHAiOjE3ODIzODY1NDZ9.vOSC_xKrApjqNY_NEWEh0xkrDXHkGRQw757sV2RVLVw)

 (image/png)    


[image2023-10-31_19-57-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDdhMWFkOWEzMzExZGM4OTE2IiwicmVmX2lkIjoiNjczOTZjNDc1OTNmOTljOWZmMjM2YzdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTQ2LCJleHAiOjE3ODIzODY1NDZ9.Jw1kQ4Tn5PYsNF4JGNmsuUNs4AHEyq0oCAjKYlI9p-w)

 (image/png)    


## Comments:

|  [](null)  ,hash无分发情况下两阶段grouping + 两阶段group路径剪枝,Posted by tansiyu at 十一月 01, 2023 10:08|
|---|
|  [](null)  ,grouping_id() 参数可去重，不去常量,Posted by tansiyu at 十一月 01, 2023 10:16|
|  [](null)  ,distinct列移入grouping sets时也可去重,Posted by tansiyu at 十一月 01, 2023 10:19|
|  [](null)  ,explain打印,Posted by tansiyu at 十一月 01, 2023 10:19|
|  [](null)  ,hash grouping cost,Posted by tansiyu at 十一月 01, 2023 10:20|
|  [](null)  ,require Hash场景？,Posted by tansiyu at 十一月 01, 2023 10:21|
|  [](null)  ,带distinct文档补全,Posted by tansiyu at 十一月 01, 2023 10:26|

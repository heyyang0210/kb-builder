Created by 谭思宇 on 十一月 03, 2023

  [YDBRD-21536](https://jira.yasdb.com/browse/YDBRD-21536?src=confmacro)    -  Distinct支持DN上执行  完成

##   [1. Overview（概述）](#1-overview概述)  

本需求的主要作用为满足TPC-DS中distinct需求，于优化器中补全两阶段distinct与单DN hash路径

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 现状说明](#21-现状说明)  

当前分布式下仅支持cn distinct，即require unique时只有singleton一个childprop

可以参考当前requireUnique部分

```
CodResult requireUnique(CboOptimizer* cboOpt, CboOperator* op, ExtraProp* oriProp, ObjectArray* outProps)
{
    // 1.inherit
    COD_CALL(makeSingleUniqueProp(cboOpt, op, oriProp, outProps));

    if (isCoordExec(cboOpt-&gt;stmt) || !isColumnStored(op)) {
        return COD_SUCCESS;
    }
	// 此处非分布式直接返回
}

```

在makeSingleUniqueProp里面当原始dstb需求不为空时，只创建了一个localDstbDesc，即只有CN单物理路径。

###   [2.2 新增说明](#22-新增说明)  

####   [2.2.1 distinct DN执行](#221-distinct-dn执行)  

最简单的单表扫描的场景下，如果distinct列为分布键列的子集，那表扫描上来的结果已经按照distinct列分布在了不同的DN上，此时各个DN可以各自做完distinct再将数据汇总，此时已经满足所有的distinct条件，即只需要做一次distinct即可。

在此场景下能够充分利用各个DN的计算能力，因此此场景下相比于CN做distinct，应该是必选DN distinct的路径。

####   [2.2.2 distinct两阶段](#222-distinct两阶段)  

考虑这样的场景，当distinct列不为下方算子的分布键时，可以构造以下三个路径：

![](https://pingcode.yasdb.com/atlas/files/public/67396c3da1ad9a3311dc88ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

当数据量非常大，有100万条的数据，4个DN，每个DN均匀分布即每个DN上25万条数据，但是如果从数据特征来看，distinct列的distinct值非常少，假设该列distinct值只有4个的情况下，我们来对比这三种情况。

>   1. CN distinct
    1. px：100万分发
  1. distinct：100万运算量
  

---


>   1. DN distinct
    1. px：100万分发（distinct列不为分布键）
  1. distinct：25万运算量
  

---


>   1. 两阶段distinct
    1. dn distinct：25万运算量
  1. px：16条分发
  1. cn distinct：16条
  

因此可以看出，该场景下两阶段distinct的代价较其他路径大大减少。

##   [3. Interfaces（接口）](#3-interfaces接口)  

增加logi to logi阶段distinct to phase2函数，剩余调整只需增加对应的结构体以及调整requireUnique即可。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

两阶段distinct的第一阶段不产生hash require，即一阶段distinct必定不会有PX

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c3da1ad9a3311dc88cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

1.添加对应的logiDistinct转两阶段的枚举LOGIDIST2PHASE2加入逻辑转逻辑部分的数组。

![](https://pingcode.yasdb.com/atlas/files/public/67396c3d8970c2af4f520a5a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

2. 加入logiDistinct自身的transForm数组中

![](https://pingcode.yasdb.com/atlas/files/public/67396c3d8970c2af4f520a5b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

3. gOpTransforms将explEnd改为1，表示从第一个成员开始为逻辑转物理，即第零个成员为逻辑转逻辑

![](https://pingcode.yasdb.com/atlas/files/public/67396c3da1ad9a3311dc88cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

4. trans_unique.c与.h 文件中加入对应的phase2函数

内部具体内容下面展开

![](https://pingcode.yasdb.com/atlas/files/public/67396c3d8970c2af4f520a5d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

5. 在gCboTransformer数组中加入对应成员

以上是所有关于原有流程上需要增加的部分。

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

####   [**logic to logic**](#logic-to-logic)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c3da1ad9a3311dc88cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

逻辑到逻辑阶段的转换整体可以参照txformLogiGroup2Phase2，需要在OpLogiDistinc和OpPhysUnique上增加类似AggrMode的标记位用以是partial，final还是complete阶段。

####   [**logic to physic**](#logic-to-physic)  

将对应distinct mode赋值给physic op

####   [**requireUnique**](#requireunique)  

当前requireUnique函数如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c3da1ad9a3311dc88ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnUUFFQUFBQkFJQUFBRUFBQUFBQUFBRUFBQUFBQUNBQ0FBQUFBQUFBQUFBQkNBQUFGQUNBQUFFQUFBQUFBQUFBQUNBQUFnQUFBQUVZQUFBQUFJQUFBQUFBRUFBQUFrQUFBSUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQVFFQUFCQUFBQUFBQUFBQUFBZ0FCQUFBUUFBZ0FBQUFJQUFBQUFBQkFCQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwMDEsImV4cCI6MTc4MjMxMDgwMX0.tqj4WvUHL678HbAXTS0mbG79w2KW9Mz9xJ_Go2Pi8eQ)

hashpart部分注意需要增加条件，只让distinct complete进入即可。

而缺失的两阶段路径同样可以参照requireGroup函数中的phase2 group分支往下require random即可

## Attachments:

[image2023-11-3_11-27-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2M4OTcwYzJhZjRmNTIwYTUzIiwicmVmX2lkIjoiNjczOTZjM2M3MjgyMDZlZmI5MmYwZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDAxLCJleHAiOjE3ODIzODY0MDF9.CFzdBWW1y2enYFyowS3wB42p76ba4zw6PL11QjI5EmM)

 (image/png)    


[image2023-11-3_10-34-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2Q4OTcwYzJhZjRmNTIwYTU4IiwicmVmX2lkIjoiNjczOTZjM2M3MjgyMDZlZmI5MmYwZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDAxLCJleHAiOjE3ODIzODY0MDF9.ucNgO4kB2Kx_uDckaOgwlMdbRVP-ro7XbuVfbVNePLo)

 (image/png)    


[image2023-11-2_11-45-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2RhMWFkOWEzMzExZGM4OGM4IiwicmVmX2lkIjoiNjczOTZjM2M3MjgyMDZlZmI5MmYwZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDAxLCJleHAiOjE3ODIzODY0MDF9.w-ZnKGyA2vZdzACb8gXIl7QtQrL_Hdi4Dt87D8eHDQY)

 (image/png)    

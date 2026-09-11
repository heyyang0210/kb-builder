Created by 唐嘉欣, last modified on 八月 02, 2024

*IR链接：*  ：    [https://pingcode.yasdb.com/ship/ideas/6614fda5009f91eb87f32f40](https://pingcode.yasdb.com/ship/ideas/6614fda5009f91eb87f32f40)    ?#YASHAN-2816 OrderBy性能优化

*SR链接：*  ：    [https://pingcode.yasdb.com/pjm/items/6618e8bafd997db58ad83034](https://pingcode.yasdb.com/pjm/items/6618e8bafd997db58ad83034)    ?#YDBRD-26177 OrderBy性能优化

##   [1. 总述](#1-总述)  

在批量执行框架下实现OrderBy和TopN的批量执行。整体目标：

- 1.OrderBy和TopN的性能要明显优于单行执行。


###   [1.1 需求来源](#11-需求来源)  

在行存引擎跑批生成报表的场景，数据量大，表达式计算复杂，YashanDB和Oracle在SQL引擎的计算效率上的差距非常明显，性能通常落后2到10倍之间，客户对性能提升述求明确。 通过对聚集函数场景指令分布分析，SQL引擎和存储引擎指令数量各占比50%，即使没有SQL引擎，YashanDB仍然与Oracle有性能差距。因此优化执行代码无法解决成倍的性能差距。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

本需求的目标是通过批量执行来优化OrderBy的性能。

大数据量测试OrderBy时，输出结果太长了，为了方便测试和验证，基于OrderBy实现TopN

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|批量执行排序物化区|见下文|是|是|----|
|功能|OrderBy算子|见下文|是|是|----|
|功能|TopN算子|见下文|是|是|----|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无开源依赖

##   [2. 接口](#2-接口)  

- order by sql语句：order by c1 asc/desc nulls first/last, c2 asc/desc nulls first/last
- top n sql语句：order by c1 asc/desc nulls first/last, c2 asc/desc nulls first/last limit 10


##   [3. 规格与约束](#3-规格与约束)  

- 1.批量执行物化区的页面通过PQ_POOL分配，页面大小为256KB，能使用的最大内存大小为PQ_POOL_SIZE的80%，可通过配置项_PQ_POOL_SIZE进行调整。
- 2.由于optmzr->owner一个内存块只有16KB，order by排序键最多2048个。
- 3.快排不稳定
- 4.单行物化区一行数据大小不能超过64KB，批量排序物化区会将原始数据根据定长和变长拆分成row和heap两部分，每部分均不能超过64KB。因为拆分后每部分的数据量都变小了，所以实际上批量排序的物化区允许的一行数据大小比单行物化区大一点。


##   [4. 特性](#4-特性)  

###   [4.1 批量执行排序物化区](#41-批量执行排序物化区)  

基于原有批量执行物化区，为了适配排序的使用场景，需要重新设计和实现排序物化区。

  


关于物化区的概念更详细的解释可参考文档：    [物化区概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147763760)  

排序物化区SortSegment主要基于TupleSegment实现，包含radix、blob、payload三个分区。radix分区主要用于保存定长排序键，blob分区主要用于保存变长排序键，payload分区主要用于保存排序键对应的载荷数据。物化区的整体设计如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396eaea1ad9a3311dc98ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0lBUUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBZ0FBQUFDQUFBQUFRQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBSUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3NzYsImV4cCI6MTc4MjQ0OTU3Nn0.XIj2rZZLnFbnMCKoU5TBvLrH2vkMwhbcaOWJ7k97Qys)

![](https://pingcode.yasdb.com/atlas/files/public/67396eae8970c2af4f521a5b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0lBUUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBZ0FBQUFDQUFBQUFRQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBSUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3NzYsImV4cCI6MTc4MjQ0OTU3Nn0.XIj2rZZLnFbnMCKoU5TBvLrH2vkMwhbcaOWJ7k97Qys)

底层实现物化区存储、数据读写的结构：

![](https://pingcode.yasdb.com/atlas/files/public/67396eae8970c2af4f521a5c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0lBUUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBZ0FBQUFDQUFBQUFRQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBSUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3NzYsImV4cCI6MTc4MjQ0OTU3Nn0.XIj2rZZLnFbnMCKoU5TBvLrH2vkMwhbcaOWJ7k97Qys)

物化区各个对象的生命周期：

![](https://pingcode.yasdb.com/atlas/files/public/67396eaea1ad9a3311dc98cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0lBUUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBZ0FBQUFDQUFBQUFRQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBSUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3NzYsImV4cCI6MTc4MjQ0OTU3Nn0.XIj2rZZLnFbnMCKoU5TBvLrH2vkMwhbcaOWJ7k97Qys)

###   [4.2 基于radix segment的排序](#42-基于radix-segment的排序)  

####   [4.2.1 binary compare](#421-binary-compare)  

排序算法实现了一套快速内存比较机制，通过对原有数据进行encode，即可对待比较的数据使用memcpm进行快速比较。radix segment和同是存储排序键的blob segment的一个重要区别就是radix segment会对原始排序键数据进行encode，以加快排序时比较的速度。

- 对于数值型数据，在小端系统中，低字节存在低地址，因此不能直接采用memcpm。encode阶段会将数据改写成类似大端的高字节存在低地址的模式，且为了比较null，会在首个字节保存是否为null的信息，当nulls first时，说明null比较小（升序），那么第一个字节应该为0，反之为1
- 对于降序排序，可直接对原有的encode结果进行异或取反，即可实现大小颠倒


采用这种方法进行比较时，没有条件判断等打断cpu流水线的操作，且能够更好的利用cpu SIMD（指令级并行）的机制，可以有效提升比较的性能。

示例4.1（integer类型的encode过程）：

  点击此处展开...

算法介绍：

1. 为了方便比较null的大小，需要将首个字节用于标记是否为null。如果nulls first，那么是null首字节为0，不是null首字节为1，如果nulls last，则反之；
1. 很容易看出，大端存储时，可以直接使用memcmp比较大小（当然还要考虑正负数的情况，还需要处理），因此如果是小端存储时，需要转换为大端存储；
1. 为了使负数小于正数，需要手动将符号位反转，即符号位（最高位）在正数时是1，负数时是0；


输入integer数据：-651464，对应16进制：FF F6 0F 38，大端存储（从低地址到高地址）：FF F6 0F 38，小端存储（从低地址到高地址）：38 0F F6 FF

encode过程（小端，nulls first，存储encode结果的buffer初始化为0）：

1. 先在首字节加入是否为null的标记：| 00 | 00 | 00 | 00 | → | 01 | 00 | 00 | 00 | 00 |
1. 小端转大端：| 01 | 00 | 00 | 00 | 00 | → | 01 | FF | F6 | 0F | 38 |
1. 符号位反转：| 01 | FF | F6 | 0F | 38 | → | 01 | 7F | F6 | 0F | 38 |


得到最终encode结果：| 01 | 7F | F6 | 0F | 38 |

PS. 如果是无符号数据，则不需要反转符号位的过程

示例4.2（number类型的encode过程）：

  点击此处展开...

算法介绍：

number数据与integer不同，number是采用科学计数法记录数据的，有符号位sign，指数exp，值value。正常情况下，要比较两个number的大小，需要对齐exp，再比较value，但是排序时无法找到一个可以统一对齐的exp，因此改为最大化value，这样就可以比较exp。

证明为什么要最大化value：

具体过程如下：

1. 首个字节用于标记是否为null，同上；
1. 接下来2字节用于存符号位，负数是0，正数是1；
1. 接下来2字节用于存最小化后的exp；
1. 接下来16字节用于存encode后的value（large int）；


输入number数据：

示例4.3（double类型的encode过程）：

  点击此处展开...

算法介绍：

number数据与integer不同，number是采用科学计数法记录数据的，有符号位

####   [4.2.2 插入排序](#422-插入排序)  

当排序键是定长数据，且数据行数小于等于24时，采用插入排序；

排序总体流程是先对radix/blob segment进行排序，radix/blob有序后，再根据顺序拷贝payload segment，即reorder，最终实现有序

####   [4.2.3 基数排序](#423-基数排序)  

当排序键是定长，且数据行数大于24时，采用基数排序LSD/MSD；

LSD（Least significant digital）是从右至左，依次按每个字节排序，由于每次排序均是稳定的，所以结果仍旧有序。LSD比较适合排序键位数较短的场景，只有当排序键size小于等于5字节时，才会采用LSD；

MSD（Most significant digital）是从左至右，依次按每个字节划分子桶，再分别对子桶进行MSD/插入排序；

####   [4.2.4 快排pdqsort](#424-快排pdqsort)  

当排序键是变长时，采用快排。变长数据不能全部保存在radix物化区中，radix物化区只保存变长数据中的部分定长前缀，全部变长数据需要使用blob物化区保存。因此在排序时，先采用快排对变长数据前缀（即radix物化区）进行一次排序，前缀相同的数据会组成一个tie，然后在tie的内部对blob物化区进行快速排序。如果blob快排时发现有不相等的数据，此过程会将一个tie拆分成多个tie。

###   [4.3 基于blob segment的排序](#43-基于blob-segment的排序)  

###   [4.4 OrderBy算子](#44-orderby算子)  

OrderBy算子最重要的任务就是实现排序算法，目前实现了插入排序、基数排序、快速排序三种算法。排序的整体设计如下图所示，它依赖物化区TupleSegment存储数据。

###   [4.5 TopN算子](#45-topn算子)  

TopN算子基于OrderBy算子实现，order by limit

TopN算子当sink数据量达到一定阈值时，会触发reduce，进行一次归并，算出此时的前n行数据，并根据前n行数据，得到一个阈值boundary。利用阈值boundary，在后续sink时，会丢掉一些已经确定无法达到前n行的数据，从而减少排序的数据量。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 1.order by单个排序键，升序/降序/nulls first/nulls last
- 2.order by多个排序键，升序/降序/nulls first/nulls last
- 3.order by定长数据类型
- 4.order by变长数据类型
- 5.order by不同数据量排序，低于24行，高于24行
- 6.order by超大数据量，涉及物化区换入换出


##   [6.资料设计章节](#6资料设计章节)  

不涉及资料。

##   [7.未来规划](#7未来规划)  

- 1.实现多线程归并


## Attachments:

[image2024-6-14_11-3-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWQ4OTcwYzJhZjRmNTIxYTUyIiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.3lBxYMSWCZjyoQuh3M-dL8RwktHY4ah9ya3gTq-UHoU)

 (image/png)    


[image2024-6-14_11-4-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWQ4OTcwYzJhZjRmNTIxYTUzIiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.9LKp4vSnP3Ojs7leQbsL3C4qZ_YUObrIj4kHjY0xcGc)

 (image/png)    


[image2024-6-14_11-33-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWRhMWFkOWEzMzExZGM5OGM3IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.C0g_218kWv9_eWjSxmHXjnDwksinvFFkHei1e01Smw4)

 (image/png)    


[image2024-7-6_18-16-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWQ4OTcwYzJhZjRmNTIxYTU0IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.8hR1zUZl3joKo-0eGxIn6l9PVICug3-s42UGlJNkagw)

 (image/png)    


[image2024-7-6_18-17-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWQ4OTcwYzJhZjRmNTIxYTU1IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.CPikiPVwVmiPSxwuv-enNHIyak6yidbB3Ipg8nx-iPk)

 (image/png)    


[image2024-7-6_18-19-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWRhMWFkOWEzMzExZGM5OGM4IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.xMQVm9LeooQu5no23GC49yxoOIiKmzr4LJoO5dBx1Ss)

 (image/png)    


[image2024-7-6_18-19-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWQ4OTcwYzJhZjRmNTIxYTU2IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.EDwiKTXGQ4s28l-uobbPXfVFGk8voSDFYZZosizITDY)

 (image/png)    


[image2024-7-6_18-20-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWRhMWFkOWEzMzExZGM5OGM5IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.atOa3KOnXnulOHQyLM2v0sMHv8Msg0lquQjRZJbKJ_s)

 (image/png)    


[image2024-7-6_18-20-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWRhMWFkOWEzMzExZGM5OGNhIiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.lFeWoew0ri1lQ0Hh3-8vtArCkPkBBNB7eWyKyGZe0UQ)

 (image/png)    


[image2024-7-6_18-21-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWRhMWFkOWEzMzExZGM5OGNiIiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.qbj4yb6b9ph4Os9KDDxVFFLfody6vNat00Ln3rWts2U)

 (image/png)    


[image2024-7-6_18-21-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWU4OTcwYzJhZjRmNTIxYTU3IiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.7dU2CqkfD8oum0GSx2HptAdoilQLakCTr7VHXMEwlA4)

 (image/png)    


[image2024-7-6_18-22-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYWVhMWFkOWEzMzExZGM5OGNjIiwicmVmX2lkIjoiNjczOTZlYWQ1OTNmOTljOWZmMjM4N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Nzc2LCJleHAiOjE3ODI1MjUxNzZ9.xHwkWEARm-_M_iMd-KXU1nWeJltWK-HjjXRkZl2q81k)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,1. 补充文档，binary compare，增加int例子（包含正负数、null）、number浮动精度encode方法
1. LSD改为5字节
1. LSD/MSD英文全称
1. LSD/MSD增加一个排序流程图
1. 基数排序增加一个通用的文档
1. 说明使用快排的原因（灵活性）
1. 换入换出补充文档
1. limit绑定参数，测试是否支持
1. 详细介绍radix、blob、payload物化区：radix涉及encode、binary compare，radix和blob共同组成排序键等
,Posted by tangjiaxin at 七月 08, 2024 10:10|
|---|

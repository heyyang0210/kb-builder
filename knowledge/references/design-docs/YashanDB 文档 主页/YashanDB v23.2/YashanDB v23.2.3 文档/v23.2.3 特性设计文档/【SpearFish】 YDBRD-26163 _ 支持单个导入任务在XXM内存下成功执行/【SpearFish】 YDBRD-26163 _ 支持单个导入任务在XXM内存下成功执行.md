Created by 黄文早, last modified on 六月 03, 2024

  [https://pingcode.yasdb.com/pjm/items/6618e311fd997db58ad823f7](https://pingcode.yasdb.com/pjm/items/6618e311fd997db58ad823f7)    ?    
  #YDBRD-26163 支持单个导入任务在XXM内存下成功执行

#   [YDBRD-26163 : 支持单个导入任务在XXM内存下成功执行](#ydbrd-26163--支持单个导入任务在xxm内存下成功执行)  

##   [1. Overview（概述）](#1-overview概述)  

目前，lsc 冷数据导入时，在多列，多分区场景下，根据配置的最小配额，需要分配较多的内存，在内存不充足的场景下，容易造成报错。因此需要设计一个方案，保证在多分区，多列的场景下，导入的最小内存与列数量，分区数量无关。

##   [2. Features（功能特性）](#2-features功能特性)  

1. 提供保证单线程导入可以成功的最小配额


##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

内存不足会换入换出，导致性能下降

最小配额需要限制分区数量 10000个导入涉及的分区

internal 分区 如果导入过多 新分区，可能 会因为动态分配导致内存不足。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

当前Rgd 导入流程为：导入的数据每个分区都有两个Rgd，每个Rgd 上由一块buffer，当rgd 满之后，将生成一个写入任务，传给转换线程，转换线程负责将已经满的DataSet 向冷数据writer 中写入。

![](https://pingcode.yasdb.com/atlas/files/public/67396d5f8970c2af4f52125c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4MDgsImV4cCI6MTc4MjMxODYwOH0.UOjaev3C6FKFfs1J6C_5Hce9ViTWcCK1pHOn0Jv6IvM)

###   [5.1优化点： coast 刷盘性能优化](#51优化点-coast-刷盘性能优化)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=152994409](https://conf.yasdb.com/pages/viewpage.action?pageId=152994409)  

目前已有需求实现，本需求在改需求基础上进行改造。改需求保证，coast writer 和rgd buffer 内存不足时，数据内存可以通过换出，提供coast writer和rgd buffer 的最小内存。

###   [5.2 优化点：限制coast writer 数量](#52-优化点限制coast-writer-数量)  

######   [优化场景](#优化场景)  

​	多分区导入，从而导致最小内存评估很大。

######   [原因分析](#原因分析)  

​	由于coast writer 需要的最小内存，在4096 列场景下，为50MB左右，分区和rgd 数量多时，需要增加内存比较大。

######   [优化方案](#优化方案)  

​	控制同时存在的 coast writer 数量，导入线程中，所用writer 公用一个配额分配器，当需要为一个分区创建writer 时，分配writer 最小配额。如果分配不成功，该分区数据先缓存再rgd 中。rgd 缓存满时才可进行刷盘。该方案实现以下功能：

1. rgd buffer 可以缓存足够多的数据。
1. rgd 相关内和换入换出内存需要在导入时提前创建。
1. 当存在一个rgd的所有buffer 满时，需要将写入行数最多的一个rgd 刷盘，并将该rgd 的writer 配额提供给已经满的rgd。
1. rgd 可能需要缓存足够多的数据，因此需要rgd 支持如下的buffer 分配策略：内存充足时，按2 的幂次分配新的rgd buffer 行数，现在有16 个rgd buffer，可以满足条件。


######   [总体导入流程](#总体导入流程)  

1. 根据表定义，分别计算最少需要的内存配额，如果是internal 分区，预留一些备用rgd ,暂定64个分区的rgd，申请rgd最小配额和一个slice 最小内存配额。
1. 内存配额分为两个，一份为rgd 配额，一份为writer 配额。
1. 导入过程中，要往一个新的rgd 中写数据，先分配writer 的配额，剩余writer 配额不足，该分区不提交任务给后台刷盘。
1. 不断写入，如果写入过程中，存在rgd buffer 满导致无法分配writer 配额。找到写数据最多的writer , 将writer 对应的rgd 数据刷盘，生成新的slice。
1. 到导入完成时，尝试为分区分配刷盘配额，并且rgd 内存释放时，释放rgd 的配额。


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




增加rgd 模块自测用例

DataSet  新varchar类型列用例

大数据量，内存不足导入不报错用例

##   [7.资料设计章节](#7资料设计章节)  

​	 调整资料中bulk load 导入使用指导，给出，不出现换入换出，每个线程需要的最小内存和该最小内存对应的分区规格

###   [8. 遗留问题](#8-遗留问题)  

优化writer 和 rgd 配额平衡策略

## Comments:

|  [](null)  ,rgda 可以提前创建，但是不绑定分区    
  默认刷盘策略可能导致性能下降    
  多个分区之间内存平衡,限制rgd 刷盘的总量，达到之后等待数据刷盘,Posted by huangwenzao at 六月 03, 2024 15:14|
|---|

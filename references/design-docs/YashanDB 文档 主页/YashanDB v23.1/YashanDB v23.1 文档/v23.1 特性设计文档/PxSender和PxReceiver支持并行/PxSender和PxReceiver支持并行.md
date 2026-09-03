Created by 黄靖东, last modified on 一月 29, 2024

#   [PxSender和PxReceiver支持并行](#pxsender和pxreceiver支持并行)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-14153](https://jira.yasdb.com/browse/YDBRD-14153)  

##   [1. Overview（概述）](#1-overview概述)  

当前Stage在多个节点执行，其是基于分片进行并行的而Stage内部是基于分区进行并行的。当前stage 发送数据都是要合并成一个线程后发送，到达接收端之后，只有一个线程接收，接收完成之后，如果要并行，就要再次分发给并行线程。对外呈现就是Stage在一个节点内部并行实现全并行，因为stage的sender和receiver都没有并行。本方案就是要解决stage全并行，并且减少数据的重分发。

##   [2. Features（功能特性）](#2-features功能特性)  

(1) PxSende直接分发数据到TableQueue(2) PxSender和PxReceiver都可以并行

##   [3. Interfaces（接口）](#3-interfaces接口)  

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 本特性做了之后，性能不一定比之前好，但是其主要是受通信的影响，后面通信之后，性能会变好。
- 本特做了之后，通信需要Queue pool会更加大，通信优化后会解决此问题
- 并行worker数不够，会报错（master版本当前也受这个限制）
- 分布key是两个的场景，目前都会有分发的(现有优化器规格)


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

- Table Queue：Table Queue
- Table queue writer:
- Table Queue Reader:


![](https://pingcode.yasdb.com/atlas/files/public/67396a41a1ad9a3311dc7bd1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIyMTYsImV4cCI6MTc4MjIyMzAxNn0.Bv42itduml7itvUOkxu3Ne19W6AZnt_SKTcSdUEFdeo)

####   [5.1.1 PxSender直接分发数据到Tablequeue](#511-pxsender直接分发数据到tablequeue)  

计划上看到remote PxSender的n->n的分发，是分发到对端的队列，而不是节点。PxSender分发数据时，先确定数据的节点，后确定数据在对应节点的Tablequeue。当前TableQueue和线程数保持一致。当前定位数据节点位置的算法跟现有算法一致，也就是先算出来chunk id， 后取模得到节点ID， 计算queue id的算法为先算出来part id（用当前分区算法）， 后取模得到partition id。所使用的hash 值计算都是一样的。当表的分区数为0时，分区定位到TableQueue的策略是hash值对并行数取模得到Table Queue数量(单机上对于没有分区的表，计算方法也同步修改，因为单机上并发和stage内的并行，算法是一致的)。分布策略会出现下面的情况

- 无Rmoete分发和本地分发


```
对于hash group，如果分布key是Group key的子集，且分区key是Group key的子集，就可以没有remote分发和本地分发

对于hash join，probe分布key和builder表分布key相同，且分区key相同，且都是join key的子集，就可以没有remote分发和本地分发

```

- 无Remote分发，有本地分发
- 对于hash group，如果分布key是Group key的子集，且分区key（没有分区key也是一样的）不是Group key的子集，就可以没有remote分发，但是有本地分发对于hash join，probe分布key和builder表分布key相同，是join key子集，但是分区key不相同，或者不是join key的子集，就可以没有remote分发，但是有本地分发
- 有Remote分发，无本地分发分布key和分区key都不是hash group key的子集， hash group会有remote分发，无本发分发（实际上是本地分发和remote分发合并到了remote分发）分布key不同，或者分布key不是join key的子集，分区key不同或者分区key不是join key的子集
- 有Remote分发，有本地分发此种场景不存在，一个px不会出现有remote hash 分发，又有local hash 分发


####   [5.1.2 PxSender和PxReceiver都并行](#512-pxsender和pxreceiver都并行)  

PxSender是Stage的入口的第一个算子。PxSender并行，实际上就是Stage多实例并行，每个实例运行在不同的线程里面。PxReceiver也可以并行执行，其接收所有节点发过来的同一Table Queue reader的数据。

####   [5.1.3 执行上的修改](#513-执行上的修改)  

当前列存执行Bind是无法并发的，主要是有些地方需要第一个task 做资源的初始化（后续可以改进成任意的线程都可以进行全局资源的初始化），所以当前是第一个线程先做资源的初始化，后面的线程可以并行做初始化

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
|hash group 分布key是group key子集， 分区key是group key子集|
|hash group 分布key是group key子集， 分区key不是group key子集|
|hash group 不是group key子集， 分区key是group key子集|
|hash group 不是group key子集， 分区key不是group key子集|
|hash group 表是复制表|
|hash join probe表和bulder表分布key一样，且是join key子集， 分区key一样且是join key子集|
|hash join probe表和bulder表分布key一样，且是join key子集， 分区key不一样|
|hash join probe表和bulder表分布key不一样， 分区key一样且是join key子集|
|hash join probe表和bulder表分布key不一样， 分区key不一样|
|hash join probe表和bulder表有一个是复制表|


以上场景要叠加并行，分区并行

7.资料设计章节资料在设计阶段，要识别出来相关需要调整的范围、大纲。

1. TODO（遗留问题）说明本方案遗留的问题或下一步需要解决的问题。


## Attachments:
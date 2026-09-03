## 1. 总述

  [https://pingcode.yasdb.com/ship/ideas/669f19684283cf23d4f24e15](https://pingcode.yasdb.com/ship/ideas/669f19684283cf23d4f24e15)  ?  
#YASHAN-2997  stage增加按需启动的调度方式

### 1.1 需求来源

   需求来源于tpcds benchmark和嘉实基金。

    **需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

### 1.2 调研文档

    **概述**   友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

当前分布式实现中，所有的Stage会按照已经的步长划成了多个StageGroup，每个StageGroup执行时，会把所有的Stage线程都启动了，相当于所有的Stage都会执行。这种做法的主要缺陷就是有些依赖后面Stage的场景，其也先执行了，如果其需要大量的内存，网络等资源时，其会跟需要的真正执行的Stage竞争内存，网络等资源。在资源不足的场景下，对系统的性能影响是比较大的。另外就是划分Stage Group时，并没有考虑把runtime filter的使用者和生成着放到一个Stage Group，已经划分好Stage Group之后，再把跨了Stage Group的runtime filter给禁止了。考虑到当前划分StageGroup的局限性 。当前考虑stage 不按照Stage group的方式划分。所有的stage按照火山模型进行调度。跟火山模型又有些区别，不严格按照拉的模型来驱动stage来执行，我们采用推拉模型来执行。详细后面描述

### 1.3 需求分析

功能列表

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|按照火山模型执行选出来第一个要执行的Stage|||||
|功能|Stage启动方式调整，Stage作为任务，线程先启动，后从调度任务中获取Stage实例执行|||||
|功能|runtime filter改造|runtime filter不再需要死等了， runtime filter也不需要再有发送失败||||
|Dfx|需要增加视图，用于维护Stage状态，可用于查看Stage状态|||||


### 1.4 数据字典

|术语|描述|借鉴业界|参考|
|---|---|---|---|


### 1.5 开源依赖

   无

## 2. 接口

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|


## 3. 规格与约束

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**    
规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。



1. 当前先考虑向量化执行引擎的改造


    2. 在划分多Stage Group的情况下，不考虑走当前的调度方式，因为划分Stage Group之后，stage变成了森林，并不是所有的stage 都有依赖关系了。无法通过一个stage驱动所有的stage执行。

## 4. 特性

### 4.1 Stage的依赖关系



Stage依赖关系改造：一个Satge启动，一定要其依赖的第一个Satge先启动，也就是按照火山模型查找stage第一个要执行的算子，如果此算子是Px算子，继续查找新的Stage所依赖的第一个算子，如果第一个要执行的算子不是Px算子，那么Stage的第一个依赖的Stage就是其自己，其才有启动的必要。因此Stage需要找到其依赖的第一个Stage。对于整个分布式来说，第一个要启动的Stage一定是列转行下面的第一个Stage所依赖的第一个Stage先启动。这个stage可以是默认就要启动的。



除了第一个需要启动的Stage外，其他的Stage启动都要采用下面的方式启动。

- 当对应Stage需要接收数据时，也就是数据生产者push数据时触发。
- Stage的接收者执行到px receiver时，此时需要把其依赖的Stage的第一个依赖的Stage启动起来。


![pull stage.png](https://pingcode.yasdb.com/atlas/files/public/674e6301a1ad9a3311de3da6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0FBQUFBQUFBQUFDQUFBQUFFQUFRQUlBQUFBQUFBQUFCQUFBQUJBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4ODcsImV4cCI6MTc4MjQ2NzY4N30.R8SjT3Eg9nKxI_r1-XRxfwE8a1jKhLAjR9fNndJKN1M)

在上面的执行模型里面 执行到Px(stage1)时，此时需要触发Stage1所依赖的第一个Stage2启动。



综合上面的规则，我们看一个复杂语句的执行逻辑

![Stage按需启动例子.png](https://pingcode.yasdb.com/atlas/files/public/674e63f5a1ad9a3311de3da8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0FBQUFBQUFBQUFDQUFBQUFFQUFRQUlBQUFBQUFBQUFCQUFBQUJBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4ODcsImV4cCI6MTc4MjQ2NzY4N30.R8SjT3Eg9nKxI_r1-XRxfwE8a1jKhLAjR9fNndJKN1M)

在上面的查询计划中，第一个Stage1是第一个要执行的Stage，选其依赖的第一个stage执行,  Stage1要执行的第一个算子是60层的Px算子，继续找Stage9的第一个要执行的算子，此时第一个算子是72层的 Scan算子。因此Stage 9的第一个依赖的stage就是自己。 因此 Stage9是第一个要执行的Stage。 接下来我们介绍其他Stage的执行顺序。stage 9执行时，会执行到69层的Px， 此时会触发Stage 10的执行，之后Stage 9向Stage1发送数据，此时Stage1需要启动，此时Stage 10已经结束了。由于stage 9是stage1的builder节点，因此stage9执行完之后，才会继续执行Stage1的其他算子

Stage 1继续执行，会执行到第29层的Px，此时要看Stage2要执行的第一个算子，其是第51层的Px，需要看Stage7要执行的第一个算子，是scan算子，因此Stage7会先执行。接下来会触发stage8执行，Stage 8上层有Hash group算子，因此Stage7发送数据之前， Stage8已经结束了。Stage7发送数据，会触发Stage2执行。

Stage2执行时，由于Stage7时buider 表的一部分，需要Stage7先执行完，才会触发其他算子的执行。

会执行到34层的Px算子，Stage3依赖的第一个Stage4是Stage3依赖的第一个Stage，会先执行到Stage4, Stage4执行到发送数据，会触发Stage3被执行，stage4是builder表，因此Stage4执行完，Stage3才会执行到其他的算子，Stage3会先发送数据，触发Stage2开始执行。

stage3继续执行，会执行到43层的Px，要看Stage5要执行的第一个stage是Stage6，因此Stage6先执行，

stage6执行时，会发送数据到Stage5，此时触发 Stage5的执行。



从上面可以看出来按照火山模型执行，在没有并行和多节点并行的情况下，SQL执行树所需要的最大线程数，等于数据的每个分支上的stage数量的最大值。每个分支上stage数据的计算，需要遍历其执行树，当遇到物化算子（hash builder table、hash group/ sort等算子）时，stage数据量要重新开始算， 最后所有的段的stage 最大数量就是所有得stage段里线程数。尽快改造后理论上的线程数会减少。但是在并行和多节点执行同一stage的情况下，没有保证stage的所有实例都是同步，按照执行顺序计算最小的线程数就很难准确，因此本特性不会尝试减少线程数。这块后面计划通过Stage的非阻塞改造来解决此问题。

对于子查询， 我们把其当成一个完整的计划，其所需要的线程数独立进行计算，并且统计到执行分支里面。

### 4.2 Stage按需启动

当前stage启动都是一个stage对应一个线程，Stage实例跟worker线程绑死。目前准备改造成线程独立启动。 Stage实例作为任务队列。Worker线程从ready 队列中取Stage实例执行。当前同一Stage的所有实现实例在一个节点内，一定是全部一起启动，当前stage 最小线程评估准确之后，启动stage前，先启动执行SQL所需要的线程，Stage作为调度任务，维护两个队列，一个是等待调度的队列和已经ready的队列。

![线程执行模型.png](https://pingcode.yasdb.com/atlas/files/public/67529687a1ad9a3311de4309/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0FBQUFBQUFBQUFDQUFBQUFFQUFRQUlBQUFBQUFBQUFCQUFBQUJBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4ODcsImV4cCI6MTc4MjQ2NzY4N30.R8SjT3Eg9nKxI_r1-XRxfwE8a1jKhLAjR9fNndJKN1M)

- 等待调度队列： 所有的stage实例都作为一个调度单元，创建完就会进入等待队列，首个执行的stage实例不需要进入此队列
- stage任务ready队列：所有已经启动的队列都会进入此队列，首个执行的stage直接进入ready队列。后面push数据触发的stage，以及PxReceiver pull数据触发的拉数据。


### 4.3 Runtime filter改造



当前Runtime filter提供者和使用者存在跨节点时，当前发送runtime filter失败会报错，使用者会等待。实时上，发送报错可以不报错，因为runtime filter并不影响计划继续执行，用runtime filter只是加速。当前版本这样做，主要是使用者stage没有状态，也就是按照执行流程，这个stage是否必须要执行，如果这个stage必须要执行，这个stage上的table scan使用runtime filter的地方只能等待少量的时间，不能一直等待。

 

### 4.4 增加Stage状态视图



增加Stage状态视图是为了定位问题，目前没有视图，stage的运行状态无法查看，定位卡死等问题，大多是依靠GDB定位。应该包含如下信息，stage是否启动，stage 对于的queue id等信息



### 4.5 特性可维可测设计

### 4.6 特性安全设计

### 4.7 特性周边配合

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

## 5.未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

- Stage任务非阻塞改造


Stage 实例遇到阻塞时，其是可以释放线程，当其释放了线程后，对应的线程可以从ready队列中取其他的staghe实例执行。被置换出去的stage后面重新触发之后，重新进入ready队列。这种执行模型是数据驱动的方式。

Stage需要置换出去，重新执行，其需要重新从上往下执行，这样的代价可能比较高，可以直接从上次阻塞的算子（例如Px receiver）直接执行，这种执行模型是自低向上的执行模型了，这种模型就是pull的方式。

- 动态增加物化算子


虽然算子无阻塞可以解决SQL语句占用线程多的问题，但是算子执行还有最重点的资源就是内存，当多个需要物化的算子同时执行，就会导致需要的最小内存变大。一种解决方法是计划上尽量避免这种计划的生成。另外就是动态增加物化算子，物化算子可以把把物化算子之前的所有需要物化算子执行完。




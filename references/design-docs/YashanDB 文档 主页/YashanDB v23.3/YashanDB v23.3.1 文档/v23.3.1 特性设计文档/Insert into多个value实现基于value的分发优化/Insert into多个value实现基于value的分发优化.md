Created by 刘建中, last modified by  许中立 on 一月 30, 2024

**JIRA**  ：    [YDBRD-13632](https://jira.yasdb.com/browse/YDBRD-13632)  

# 1 overview（概述）

*简要说明本设计方案的背景、需求。*

在分布式下，目前版本中对Insert into多个values的实现，存在欠佳而待优化的地方。具体是：

***1）SQL直接执行的情况：***

在insert into多个values时，CN会将这多个value的数据，发给每个DN。比如，insert into 5000行数据，则每个DN都会收到相同的这5000行数据。

这样的实现方案有几个明显的不足：① 带来冗余的网络IO：有n个DN组，则会有n倍的冗余数据网络IO；② 冗余的计算开销，主要包括数据序列化/反序列化的计算开销，以及因为需要用额外的索引数据结构来标记DN实际需要执行insert的数据而带来的计算开销等；③ 代码实现上，这种实现方式使代码阅读起来不太直观和易于理解。

***2）绑定参数执行情况：***

绑定参数的方式，在通过jdbc的addBatch执行多条数据的插入时，在目前版本的实现中，是循环每一单条的数据进行executeSingle。比如，insert 5000行数据，则进行5000次executeSingle。

这样的实现方式：① 带来冗余的网络协议交互：插入n行数据，则CN和DN之间会有n倍的冗余协议交互，体现在insert批量数据时，性能明显下降；② 冗余的循环计算开销成本。

**本方案要解决的问题是：**

1）SQL直接执行的情况：优化已有的insert into多个values的实现方案。对每个DN，CN只会向其发送在这个DN上需要真正执行insert的数据行，减少网络IO开销和计算开销。

2）绑定参数执行的情况：实现真正的批量插入，即通过单次的协议交互来完成批量数据插入，大幅提升insert的时间效率；同时：每个DN，只会收到其需要真正执行insert的那部分行的数据。

# 2 Features（功能特性）

*说明本方案的功能特性。*

在分布式下，执行insert into多个values（包括直接文本SQL的方式和绑定参数的方式）时：每个DN都只会收到在这个DN上真正需要执行insert的那些数据行，并实现完整而准确的insert功能。

在绑定参数的方式执行时，通过单次的协议交互来完成批量数据插入，实现真正的批量执行，大幅提升insert的时间效率。

# 3 Interfaces（接口）

*列出本方案对外提供的接口、配置参数、API等。*

本方案是对insert into功能实现方案的优化。因此，提供的接口，就是insert into功能需要支持的所有接口。包括但不限于：

1） 文本SQL直接执行insert，包括jdbc、yasql、文件导入等方式；

2） 绑定参数方式insert，包括单条执行和批量执行。

# 4 Limitations（功能限制）

*说明本方案对外的功能限制或约束。*

对外的功能限制，主要包括：

1） insert into的数据行数限制；

2） 执行insert时提交给CN的数据包大小限制。

具体的限制参数值可以参考YashanDB的技术标准文档。

# 5 Detail Design（详细设计）

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

## 5.1 现状：目前实现方式

分布式下，当前版本INSERT的主要执行过程如下图所示。左侧为CN的主要执行过程，右侧为DN的主要执行过程。下图并不是一个标准的流程图，只是列出了执行主干上的主要过程和方法。

![](https://pingcode.yasdb.com/atlas/files/public/67396e918970c2af4f52196d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQkFBQUFBQUFJQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUVBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBRUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFFQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwODIsImV4cCI6MTc4MjQ0ODg4Mn0.bHfzWrQ4_5g4imvsPR0LZztz8g24LzoixF_SOF0__yU)

**图1**

在上图中，橙色框标注了“  **SQL直接执行**  ”的一些关键步骤：

- 需要insert的全部数据行，会序列化在Plan里。


- 在ConstructMsgList方法中，在DmlInfo的insertInfo，用tableIds，rowIds存放在具体某个DN需要真正执行insert的行数据在Plan的全量行数据中的索引。


- 在DN执行过程中，反序列化Plan后，从ICS读取DmlInfo，会根据其中的索引，到Plan的全量行数据中读取到真正需要在这个DN做insert的数据行，并覆写入Plan，然后执行。


上图中的绿色框，标注了“  **绑定参数执行**  ”的一些关键步骤：

- 绑定参数批量执行时，会调用anlExecuteBatch方法。


- 但在anlExecuteBatch方法中，其实际实现是通过循环，是对每一行数据，调用anlExecuteSingle。


**需要注意到**  ：绑定参数执行的这种实现方式，并不会存在“冗余行数据发送“的问题。因为ExecuteSingle时，只绑定了一行数据，并发送给需要真正执行的DN。但优化成真正的批量执行时，需要解决在“SQL直接执行”的情况下类似的冗余行数据发送问题：即，在将批量的绑定参数行数据读出来并发送到DN去执行时，对每个DN，只发送在这个DN上真正需要执行的那部分行数据。

## 5.2 方案选型

#### 5.2.1 优化数据分发

优化数据分发，即只将数据行发送到真正执行的DN，有两种思考的方案：

**方案1：**  在准备给每个DN发送Plan时，修改Plan，即在Plan的insertTables.rows上，挂载真正需要在这个DN实际执行insert的数据行。

优点：这是一种直观而自然的实现方案，执行过程清晰。

缺点：由于分发到每个DN组的Plan都存在差异，因此需要在对每个DN组发送Plan时都做序列化，而且在CN没法针对这些SQL做Plan Cache。

**方案2**  ：发送给每个DN的行数据，放在DmlInfo中。DmlInfo中不再存放table和row的索引，而是存放实际要insert的数据行。在发送给DN的Plan，对insertTable.rows不做序列化，即在Plan下不挂载任何行数据。DN在收到ICS消息时，从DmlInfo中读取需要insert的完整的实际行数据，写入Plan的insertTable.rows，并做执行。

优点：不会影响到Plan Cache的机制；避免了方案1的多次序列化Plan；可以充分利用以前实现方式中的DmlInfo数据结构，代码修改量可控。

缺点：实现方式不如方案1直观清晰。

**结合对两种方案优劣比较，采用方案2的实现方式。**

#### 5.2.2 优化批量执行

优化批量执行，即在绑定参数执行的情况下，对多条数据，实现真正的一次执行。具体实现方式：

1） 将循环方式的ExecuteSingle，改为一次批量执行。这一步会涉及到对绑定参数的读取，并计算出具体的行数据；

2） 在根据绑定参数计算出了具体的行数据后，在将数据发送到DN时，需要用到上一节（5.2.2）中的数据分发优化方案（方案2）。

## 5.3 方案架构

*说明方案的总体架构，优先考虑通过架构图进行描述。*

#### 5.3.1 SQL直接执行

##### *5.3.1.1 关键流程*

分布式下直接SQL执行的情况，本方案的关键流程如下图所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396e918970c2af4f52196e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQkFBQUFBQUFJQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUVBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBRUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFFQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwODIsImV4cCI6MTc4MjQ0ODg4Mn0.bHfzWrQ4_5g4imvsPR0LZztz8g24LzoixF_SOF0__yU)

** 图2**

上图标注出了在本方案实现中，需要改造的关键方法。

##### *5.3.1.2 数据分发逻辑*

**Step 1.**

在进入图2的ContructMsgList之前，按照如下方式计算每一行row数据的group id：

- 根据单行row数据与表描述字典，计算该行数据的distributed key；


- HASH(distributed key) 对chunk总数取模，得到chunk id；


- 通过chunk id，从route字典中得到group id。


将group id存入列表 rowGroupList：rowGroupList的第  ***i***  个元素值，即为第  ***i***  行row对应的group id。

**Step 2. **

对AnlPlan.dstbCoord.subCoordPlans的每一个subPlan，对其调用ContructMsgList，并将step1的rowGroupList带入。

**Step 3.**

在ConstructMsgList中，对rowGroupList，如果第  ***i***  个元素值等于本subPlan对应的gruop id，则将第  ***i***  行row放入DmlInfo。

#### **5.3.2 绑定参数执行**

##### *5.3.2.1 关键流程*

分布式下绑定参数执行批量insert（isBatchError==TURE）的情况，本方案的流程如下图所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396e928970c2af4f521970/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQkFBQUFBQUFJQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUVBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBRUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFFQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwODIsImV4cCI6MTc4MjQ0ODg4Mn0.bHfzWrQ4_5g4imvsPR0LZztz8g24LzoixF_SOF0__yU)

**                                                                                         图3**

其中，蓝色框标注出了在本方案中，需要重点修改或重构的方法。

分布式下绑定参数执行，DN的执行流程，与上一节（5.3.1）中描述的“SQL直接执行”情形下的DN关键流程基本相同，在此不再赘述。

##### *5.3.2.2 区分对 isBatchError 不同情况的处理*

**1） BatchError模式（isBatchError == TRUE）**

按照图3所示的流程处理，实现真正的批量insert。

注意：对多行数据批量insert，还需要将每一个insert的affect rows，作为数组返回。

**2）非BatchError模式（isBatchError == FALSE）**

在JDBC的非BatchError绑定参数模式下，以批量insert 100行数据为例：如果insert第60行数据出错，则第60~100行数据都不应该再继续执行。即，执行有一种隐含的“顺序”，第n行出错，则n+1行以后的都不再执行。

因此，对非BatchError模式的实现，仍然保持和之前版本一致：即对每行数据做insertSingle的方式。

##### *5.3.2.3 BatchError模式的边界问题解决方式*

**1）需要考虑的边界问题**

分布式下，BatchError模式绑定参数执行，有这些边界场景问题需要考虑：

*① reparse和跨包的问题*

e.g. 

         CN从service的多个packet包读到全部的绑定参数行；

--->  service会将之前已经读的packet包丢弃，只保留目前正在读且还没读完的packet；

--->  在生成plan之后，执行之前的时间点，其他client执行成功了DDL；

--->  CN和DN继续执行insert流程，DN会执行错误，因为表的元数据已经不一致；

--->  执行出错后，会释放Stmt的资源；

--->  需要做reparse，重新去packet读取绑定参数；

--->  由于之前的packet已经被service丢弃掉了，无法再次读取，最终导致错误。

*② 全部批次数据的内存占用过高问题*

由于是读取到全部批次的数据，因此可能会有内存占用问题（极端的情况36000个参数，每个参数size可以达到最大32K）。

实际实现建议不考虑参数个数和大小过于极端的情况，但因为是一次全部读取，对比ExecuteSingle的情况，内存占用问题会相对更明显。

**2）解决方式**

实现方案的主要流程是按照上图3所示。在图3的主要流程基础上，通过如下优化措施来解决上述边界问题：

- 对全部的绑定参数行，如果总size非常大的情况，支持灵活拆分成几个相对没有那么大的批次。


- 第一个批次只执行一行。这样的目的是：仅一行的数据，跨包的可能性极小（除非单行就已经超过一个Packet的大小）。即使因为元数据不一致等问题执行失败了，重新reparese时，service那边的packet包还没有被丢弃，还能继续读所有的绑定参数行。解决reparse和跨包问题。


- 根据行数阈值做拆分。比如：设定1000行的阈值，小于1000行，则可以一次insert完成，大于1000行，则拆成   *N / 1000 *  个批次去做insert。解决内存占用过高问题。


- 根据内存阈值做拆分。这种方式比“根据行数阈值做拆分”的方式更精确，但实现复杂度要高很多。比如：insert 5000行数据，发现1~3000行的大小已经超过了256M，则做下拆分，先执行1~3000行这个批次，再执行30001~5000这个批次。解决内存占用过高问题。


## 5.4 数据结构

方案中涉及的重要数据结构是DmlInfoMsg和InsertInfo：

```
typedef struct StDmlInfoMsg {
    TabQueueArg* tabQueueArg;
    InsertInfo* insertInfo;
    CodUint16    type;
    CodUint8     isNone;
    CodUint8     hasTabQueue;
    CodUint8     unused[4];
} DmlInfoMsg;
```

DmlInfoMsg的一个成员字段为InsertInfo类型：

```
typedef struct StInsertInfo {
    CodUint32* tableIds;
    CodUint32* rowIds;
    CodUint16  insertRowCount;
    CodUint16  reserved;
} InsertInfo;
```

本方案需要对InsertInfo类型做修改：

```
typedef struct StInsertInfo {
    CodChar*   rowsBuf;
    CodUint32  bufSize;
    CodUint16  insertRowCount;
    CodUint16  reserved;
} InsertInfo;
```

即：去掉了之前tableIds和rowIds字段；新增rowBuf和bufSize字段，用于存放将实际行数据rows序列化后的buffer和size。

# 6 Test Cases（自测用例）

*设计开发人员自测用例（文字描述）。*

**1）基本功能自测**

|序号|场景|预期结果|
|:---:|:---:|:---:|
|1|SQL直接执行：单行|正常执行，可以看到insert的数据行。|
|2|SQL直接执行：10行|正常执行，可以看到insert的数据行。|
|3|SQL直接执行：1000行|正常执行，可以看到insert的数据行。|
|4|SQL直接执行：5000行|正常执行，可以看到insert的数据行。|
|5|SQL直接执行：10000行|正常执行，可以看到insert的数据行。|
|6|绑定参数执行：单行|正常执行，可以看到insert的数据行。|
|7|绑定参数执行：10行|正常执行，可以看到insert的数据行。|
|8|绑定参数执行：1000行|正常执行，可以看到insert的数据行。|
|9|绑定参数执行：5000行|正常执行，可以看到insert的数据行。|
|10|绑定参数执行：10000行|正常执行，可以看到insert的数据行。|


**2）分发优化测试**

|序号|场景|预期结果|
|:---:|:---:|:---:|
|1|SQL直接执行：单行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|2|SQL直接执行：10行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|3|SQL直接执行：1000行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|4|SQL直接执行：5000行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|5|SQL直接执行：10000行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|6|绑定参数执行：单行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|7|绑定参数执行：10行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|8|绑定参数执行：1000行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|9|绑定参数执行：5000行|执行成功，每个DN只收到实际应该执行insert的行数据。|
|10|绑定参数执行：10000行|执行成功，每个DN只收到实际应该执行insert的行数据。|


**3）批量执行优化测试**

绑定参数方式执行，  **需指定为BatchError方式（isBatchError = TRUE）**  ，可以测试批量执行1行、10行、100行，1000行、2000行、5000行、10000行等场景，CN与DN之间无需按数据行循环多次协议交互。

**4）性能测试**

绑定参数执行  **（需指定为BatchError方式）**  ，批量insert。时间性能效率应比之前版本有明显提升。批量insert数据行数越多，效率提升越明显。

具体测试用例，可以批量执行1行、10行、100行，1000行、2000行、5000行、10000行等场景，并分别与老版本做对应的执行效率比较。

# 7 Workload（工作量）

*评估代码量KLOC、工作量（人天）。*

本方案的SR，需要拆分成两个AR：

① 数据分发方式优化（包括直接SQL执行和绑定参数执行）---  1.5人周

② 绑定参数执行批量insert时，去掉之前的循环singleInsert方式，重构为真正的批量方式。 ---  2人周

# 8 References（参考文档）

主要参考了Confluence上关于Plan Cache，内存管理的部分文章。

# 9 TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

# 10 评审会议纪要

会议时间：2023.5.24 16:30

会议参与人：龚雯、何阳、林俊喆、刘建中、李伟超、徐晓锋

问题总结：

1）序列化与反序列化的版本不一致问题，CN和DN灰度升级等场景需要考虑；

2）分发优化可测试性：目前的autotrace不能支持分布式下查看DN收到了多少行数据；用debug开关打日志的方式，并不能支持自动化测试；

3）distKey如何计算，rows如何存，如何分发，等一些细节逻辑需要完善；  **--- 已补充在5.3.1.2小节。**

4）是否可以不用DmlInfo，放另外的内存结构。  **--- 目前用DmlInfo主要因为考虑代码修改以及开发量。**

5）测试基准问题：性能测试需要提升多少效率，需要有一个基准。

其他：

5.25日讨论的边界问题，对绑定参数执行的方案做了一些优化调整，  **已放在5.3.2.2.和5.3.2.3小节，对测试用例也相应做了较小的调整。**

  


## Attachments:

[当前实现方式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTBhMWFkOWEzMzExZGM5N2Q5IiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.VcRQDR6d0dAhpLcTF3a9FX-VFg1sIzo4_1W17s7AEJ4)

 (image/png)    


[当前实现方式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTA4OTcwYzJhZjRmNTIxOTY3IiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.clTdIfpNGB4WYocJXrDWh5yHBrgNG6IU5N-XgLi_GSs)

 (image/png)    


[当前实现方式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTBhMWFkOWEzMzExZGM5N2RhIiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.v-h9k0L0hsEBE00lmIZRtpXPbcrl-SnzY0uOAD4MEIo)

 (image/png)    


[绑定参数执行.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTBhMWFkOWEzMzExZGM5N2RkIiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.d-CCw_42IZ7NbJyyMpTDmhJZQxpykcrsG8UW7QAq7G4)

 (image/png)    


[当前实现方式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTA4OTcwYzJhZjRmNTIxOTZhIiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.1tccs4WiEcG9N5iihYwGVHUrHV___v9OiiVuAM3Ie0U)

 (image/png)    


[绑定参数执行.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTE4OTcwYzJhZjRmNTIxOTZiIiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.14Kq7P3GQQFSH45SyWbFtmoijMLgFTeeu9YOC0XuYoE)

 (image/png)    


[当前实现方式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTFhMWFkOWEzMzExZGM5N2UwIiwicmVmX2lkIjoiNjczOTZlOTA1OTNmOTljOWZmMjM4NjdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDgyLCJleHAiOjE3ODI1MjQ0ODJ9.qjz7fnE5EjhmIXyRrhoGMf8-X3kgjamqKN9GxHd0sKU)

 (image/png)    

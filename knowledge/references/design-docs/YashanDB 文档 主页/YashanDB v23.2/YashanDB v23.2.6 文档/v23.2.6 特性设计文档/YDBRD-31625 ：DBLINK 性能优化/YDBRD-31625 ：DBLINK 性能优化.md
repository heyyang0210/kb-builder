Created by 朱月婷, last modified on 八月 22, 2024

*详细设计-YDBRD-31625 : DBLINK 性能优化 Design*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66bdc45f1ecb4664f52b6bab](https://pingcode.yasdb.com/pjm/items/66bdc45f1ecb4664f52b6bab)    *?*    
  *#YDBRD-31625 开发任务：DBLink查询性能优化*

##   [1. 总述](#1-总述)  

客户现场对dblink性能有要求，要求同样场景下与友商对齐。

###   [1.1 需求来源](#11-需求来源)  

深燃。

外场场景优化前后性能测试结果详见：    [https://conf.yasdb.com/pages/viewpage.action?pageId=159428618](https://conf.yasdb.com/pages/viewpage.action?pageId=159428618)  

###   [1.2 调研文档](#12-调研文档)  

无。

###   [1.3 需求分析](#13-需求分析)  

略

###   [1.4 数据字典](#14-数据字典)  

无。

###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

未新增接口，仅改动原始接口

##   [3. 规格与约束](#3-规格与约束)  

关注三个配置参数：

A. EXS_DBLINK_ROWARRAY_SIZE ： 为一次fetch多少行，该值为最大值，实际上将根据投影列的最大宽度调整，确保一次申请可以完成，如该值为16K，一个页面大小为32K，若投影列最大宽度为8，则该值实际为32K / 8Bytes = 4K。

B.DRV_MEMORY_BLOCK_SIZE ： 一个页面大小，页面个数综合EXS_DEFAULT_YDBC_BUFFER_SIZE决定。

C.EXS_DEFAULT_YDBC_BUFFER_SIZE ： 总内存大小，其除以单个页面大小则可得到页面个数。

限制：远端为Oracle场景下，

1.行数 * 投影列最大宽度 <= 页面大小

2.行数 * （投影列最大宽度 + 2 + 4） <= 总内存大小 ， 其中2和4分别为ociInds，ociLens空间

##   [4. 特性（优化点）](#4-特性优化点)  

###   [4.1 交互时延优化](#41-交互时延优化)  

- 原本实现 ：执行查询时，返回时会带回若干行记录，其中仅保证列完整；在yasdb侧消费完数据后发起fetch，yex接收到cmd后fetch远端一批并返回给yasdb。
- 优化分析 ：yasdb发起fetch，yex收到并fetch远端，fetch结束之后返回给yasdb。上述三步为串行，但实际上，二三步可同时执行。
- 优化实现 ：yex在收到fetch并返回给yasdb后，进行preFetch；等到下次yasdb发起fetch请求，可直接将数据发送给yasdb，无需等待。


###   [4.2 交互次数优化](#42-交互次数优化)  

- 原本实现 ：EXS_DBLINK_ROWARRAY_SIZE（最大16K），DRV_MEMORY_BLOCK_SIZE（64K), EXS_DEFAULT_YDBC_BUFFER_SIZE(32M)
- 优化分析 ： fetch一次的大小由MaxColumnSize，和上面三个配置参数决定
- 优化实现 ： 将默认值改为EXS_DBLINK_ROWARRAY_SIZE（32K），DRV_MEMORY_BLOCK_SIZE（512K), EXS_DEFAULT_YDBC_BUFFER_SIZE(64M)；均改为可配参数，通过yex.ini文件配置，最小值为原来的配置参数，最大值为Uint64_MAX。


###   [4.3 查询投影优化](#43-查询投影优化)  

- 原本实现 ： 识别到远端表后，不考虑实际需要列，以select * from table的方式查询远端获取数据
- 优化分析 ： 如果表的列数过多，或者含有columnSize较大的列，在最终的sql中表中的无关投影列过多，将花费过多时间在获取无效数据上。
- 优化实现 ： 改为仅fetch有关投影列。


###   [4.4 内部协议编解码优化](#44-内部协议编解码优化)  

- 原本实现 ： yex侧fetch到数据后，首先通过value从dataPtr中读出，再put到发往yasdb的packet中。
- 优化分析 ： 对于定长数据，中间多用value承接较为浪费。
- 优化实现 ： 改为将从oraFetch到的定长数据直接put到发往yasdb的packet中。


###   [4.5 OCI驱动解码优化](#45-oci驱动解码优化)  

- 原本实现 ： yex侧fetch到number类型后，先转text再转number。
- 优化分析 ： 中间用text中转，对性能有一定影响。
- 优化实现 ： oracle的number二进制到Yashan的number。


~~### 4.6 服务端减少cp及mv次数~~

~~* 原本实现 ： yasdb侧获取到数据后，将packet的数据copy到本地的buf中，再对数据进行处理。涉及到切换行时，还需要memmove。~~

~~* 优化分析 ： 存有数据的packet在整个数据处理过程中都不会有其他线程使用，可直接通过偏移在packet上处理数据，memcpy和memmove较为浪费时间。~~

~~* 优化实现 ： yasdb直接通过偏移在packet上获取数据。~~

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1.yex不处理数据，原始信息按列发给yasdb，yasdb按列解码。,Posted by zhuyueting at 八月 22, 2024 11:36|
|---|

Created by 李垠, last modified on 十一月 08, 2024

*概要设计-YASHAN-305 : YCS支持多盘 Design（YCS支持多盘方案设计） *

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    *?*    
  *#YASHAN-305 YCS支持多盘，支持YFS管理YCS数据*

  


##   [1. 总述](#1-总述)  

本设计主要是YCS的 voting disk和ycr disk支持多盘方案。

###   [1.1 需求来源](#11-需求来源)  

部署形态：共享集群

内部需求，提高集群产品对外竞争力。

###   [1.2 调研文档](#12-调研文档)  

ASM支持OCR和VF调研文档      [https://conf.yasdb.com/pages/viewpage.action?pageId=147770440](https://conf.yasdb.com/pages/viewpage.action?pageId=147770440)  

参考文献： 《Oracle RAC 核心技术详解》

###   [1.3 需求分析](#13-需求分析)  

本方案是将多盘放入yfs管理，带来的收益是

1）利用yfs的冗余和条带化

2）方便演进

3）提升系统稳定性，即：当某个节点不能访问磁盘时，将对应的盘离线，而不需要进行集群重构，只有当不能访问的磁盘满足一定数量时，才会触发集群重构

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|部署|yfs磁盘发现能力||是|是|----|
||yfs读写ycs、ycr文件能力||是|是|----|
||ycr获取ycs、ycr文件名称的能力||是|是|----|
|启动ycs|ycs启动能力||是|是|----|
|停止ycs|ycs停止能力|----|是|是|----|
|投票|利用多盘投票的能力|----|是|是|----|
|ycsdump工具|ycsdump展示多盘存储情况|----|是|是|----|
|升级能力|从单盘升级到多盘的能力|----|是|是|----|
|多盘状态的topo展示|ycsctl能够展示多块盘的状态（离线、在线）|----|是|是|----|
|om安装部署|om适配部署流程|----|是|是|----|
|om升级|om适配升级流程|----|是|是|----|


###   [1.4 数据字典](#14-数据字典)  

voting file 投票文件，一个投票文件存在多个副本，每个副本保存在一个disk上，副本个数与disk个数相同。

###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

**需要yfs提供的接口，其中读写接口要具备写多个副本，恢复，读多个副本的能力。**

**ycs需要读、写一个或者多个voting file上面的block，每个block有一个checksum结构，用于crc校验，当整体读取多个block时，yfs不需要进行crc校验，由ycs自己负责校验**

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|根据传入的磁盘路径返回指向磁盘的指针|入参：磁盘路径， 出参：执行磁盘的指针|----|是|
|读接口|入参：指向磁盘的指针、offset、readsize、buf，出参：读取的内容|1、yfs处理半读问题， yfs考虑这种算法：记录原始crc，多次循环如果不变，证明是有损坏，可以直接报错，如果变化，则说明其他节点正在写入，需要等待到超时时间；2、yfs要解决多副本一致性问题，采用多数派原则，ycs负责提供回调函数，增加版本号；3、yfs负责解决损坏的副本恢复的问题|是|
|写接口|入参：指向磁盘的指针、offset、buf、writesize|----|是|


##   [3. 规格与约束](#3-规格与约束)  

**兼容原来的模式——裸盘，裸盘模式不支持多盘，不会放在yfs管理**

**支持配置1、3、5块磁盘，其他数量不支持**

**(VF盘数/2 )+ 1 或者以上的数量的文件副本损坏时，集群启动失败**

**不支持增加或者删除disk和文件副本**

##   [4. 特性](#4-特性)  

###   [4.1 YCR部署](#41-ycr部署)  

yfssrv服务提供磁盘发现、创建、读写voting file、ycr file功能，在部署阶段完成磁盘发先、磁盘组创建和文件创建。

**OM按照这个流程进行适配。**

![](https://pingcode.yasdb.com/atlas/files/public/67396e20a1ad9a3311dc952f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

**ycr部署时，需要知道voting file、ycr file文件名，才能进行读写操作，采用默认值和传入参数的方法支持该参数像。**

部署流程演示：

以下命令仅作示意，不代表真实命令

1)启动YFS实例（包含磁盘发现）

```
yfssrv 

```

2)初始化diskgroup

```
yfscmd create diskgroup dg0 ... sdc

```

3)初始化YCR配置

```
yfscmd create file "+dg0/voting file";
yfscmd create file "+dg0/ycr file";
配置文件yascs.ini中配置+dg0/voting file、+dg0/ycr file
ycsctl create cluster yascluster
...

```

4)停止YFS实例

```
kill yfssrv

```

5)正常启动集群

###   [4.2 启动](#42-启动)  

【方案一】支持并发启动。yfs启动分两个阶段，第一阶段启动为备，第二阶段完成备升主。

1）ycs进程启动，马上启动yfs

2）启动yfs为备（此处需要yfs提供启动为备的接口，yfs是否具备并发启动为备时，获取ycs盘的能力？是不是每个ycs节点都能获取到？）

3）ycs获取磁盘指针（此处需要yfs提供函数，返回yd给ycs；yfs提供ycs盘、ycr盘的读写接口，参数至少为offset，readsize）

4）ycs加载配置文件和其他初始化工作

5）ycs选主

6）ycs完成启动

7）ycs主通知yfs升主

8）yfs完成备升主后，通知主ycs

9）ycs主启动yasdb，之后再通知其他ycs启动yasdb，  **注意yasdb也需要读写voting file，ycs需要将fd传给yasdb**

![](https://pingcode.yasdb.com/atlas/files/public/67396e20a1ad9a3311dc9530/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

【方案二】要求集群中存在主时，其他实例可以并发启动为备，当集群中不存在主时，不允许方法启动，必须先启动一个实例之后，才能启动其他实例。yfs启动分两个阶段，第一阶段启动提供发现ycs、ycr盘，提供ycs、ycr文件的读写能力。第二阶段在ycs选主后，以主运行或者以备运行。

![](https://pingcode.yasdb.com/atlas/files/public/67396e20a1ad9a3311dc9531/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

###   [4.3 并发停止ycs](#43-并发停止ycs)  

【方案一】yfs停止分两个阶段，第一阶段先停止除了文件读写功能的其他线程，第二阶段停止文件读写功能。

![](https://pingcode.yasdb.com/atlas/files/public/67396e208970c2af4f5216be/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

【方案二】ycs停止时，先给yfs发个通知，告诉yfs准备停止了不能够再处理任务了，然后停止ycs除了主线程的其他线程，最后再停止yfs、ycs主线程。

![](https://pingcode.yasdb.com/atlas/files/public/67396e20a1ad9a3311dc9532/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

**重启流程原来的原则是不断开连接，本方案保留这个原则，即：ycs重启就是在不断开连接并且保留ycs主线程的基础上，走一遍停止流程于启动流程**

###   [4.4 故障场景](#44-故障场景)  

ycs启动完成后，才具备故障处理能力，ycs处理故障的方式是主驱逐备，或者投票重新选主，整个故障处理过程中，对读写voting file能力要求如下：

1）yfs发现自己不是主、或者db发现ycs被驱逐，依然能够读写voting file

2）整个故障处理过程中，不论yfs主处于何种状态，都能够读写voting file

3）被驱逐的节点，进入重启流程后，能够读写voting file

下图是yfs master的状态图

![](https://pingcode.yasdb.com/atlas/files/public/67396e208970c2af4f5216bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

###   [4.5 （可选）投票的变化](#45-可选投票的变化)  

**oracle rac的算法介绍**  （下面说的丢失心跳，指的是超时后的处理，oracle的超时参数为 short I/O timeout）

原则：所有节点能够访问的VF数大于等于 N/2+1, N 为VF盘数，则集群正常运行，当小于这个数时，集群进入投票仲裁。

举例说明，比如有3块VF，如图1所示。

原则：当所有节点能访问的VF数大于等于2，集群正常工作，否则进入投票仲裁。

node1丢失对VF1的磁盘心跳，  **将VF1离线掉**  ，集群不会进入投票，也不会有节点重启，集群正常运行。如图2。

node2丢失对VF3的磁盘心跳（图3），此时node1能访问VF2、VF3，node2能访问VF2，所有节点能够访问VF2，不满足大于等于2的情况，集群进入仲裁。由于此时VF2能够被所有节点访问，所以以VF2的信息为准进行投票。

![](https://pingcode.yasdb.com/atlas/files/public/67396e21a1ad9a3311dc9533/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFCQUFBQUFBQUJRQUFBQUFRQUFBQUFBQUFDUUFCQXdBQUFBQUFBQkFBQUFBQUFBQVFFQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBRUFRQUFBRUFBQUFBZ0FBQUFBQUFDZ0FBQkFBQUFBQUFBQUFBQUFCQVFBQUFBQUFBQUFBQUFBQUFBZ0FBZ0FBUUFRQUFCQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA2MTcsImV4cCI6MTc4MjM4MTQxN30.PmhtsLev6YaeM_oKQRgWZkWd_-cAQgiUkHgeSLISWpw)

这种方案需要yfs支持以下功能：

**能够对某个VF离线(并且能够让节点重启后，重新读取每一块VF)**

**VF读写接口支持返回每一个VF的读写结果(因为YCS需要对每一个VF的健康情况进行探测)**

此项功能利用了VF多盘的优势，能够在部分VF损坏时不触发集群重构，增强了集群稳定性。本次SR可暂不支持，以后功能增强时再开发。

yfs目前的实现是，当所有副本写成功时判定为写成功，当有一个副本读成功时判定为读成功。如果我们本次不考虑oracle这个方案，就使用yfs的这个算法就行，不需要单独考虑某块盘的读写问题。

【结论】本次不考虑这个功能

###   [4.6 升级](#46-升级)  

ycs单裸盘向yfs管理的多盘升级，流程如下：

前置条件：准备好多盘硬件环境

1. 停止ycs进程（om适配，已经支持）
1. 导出ycr配置（om适配，已经支持）
1. 修改ycr导出文件，修改其中的voting file名称以及其他不兼容的配置项
1. 创建磁盘组（om适配，待实现）
1. 创建voting file （om适配，待实现）
1. 将ycr配置导入多盘（om适配，待实现）
1. 执行其他升级流程


###   [4.7 （方案二）ycs自己管理多盘](#47-方案二ycs自己管理多盘)  

为了便于两种方案的对比，在这里简单介绍以下这种方案。

4.7.1   **多盘读写的一致性算法**

考虑采用quorum机制，此方案需要设计quorum机制，这里不展开。

4.7.2   **部署流程**

需要支持3、5个数的磁盘，在配置文件中配置多块磁盘的路径。部署时，读取配置文件，将配置写入多盘。

4.7.3   **冗余模式**

ycs、ycr写入同一块磁盘，改为多盘冗余。

4.7.4   **磁盘IO接口**

读写接口改为采用quorum机制，写入、读取多个副本。

打开、关闭磁盘的接口改为打开、关闭多块磁盘。

其他流程无需变化。

###   [4.8 两种方案的对比](#48-两种方案的对比)  

||修改的流程|修改\新增的接口|是否涉及yfs|演进方向|
|---|---|---|---|---|
|yfs管理多盘|部署，启动，停止，重启，升级，投票（可选）|读写接口，离线磁盘接口（可选）|是|跟随yfs演进策略|
|ycs管理多盘|部署，升级，投票（可选）|多盘一致性算法，读写接口、打开/关闭磁盘接口，离线磁盘接口（可选）|否|不考虑演进|


##   [5.评审结论](#5评审结论)  

1. 4.5节的内容本次不实现
1. 采用yfs管理多盘


##   [6.未来规划](#6未来规划)  

1. oracle的投票算法对多盘的利用。
1. 磁盘删除、增加功能


## Attachments:

[部署ycr.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMjBhMWFkOWEzMzExZGM5NTJiIiwicmVmX2lkIjoiNjczOTZlMjA1OTNmOTljOWZmMjM4MjUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwNjE3LCJleHAiOjE3ODI0NTcwMTd9.RAWYC86rBkQPk5iIJS9uxSSwZrR_Y4kMD08omCo-zmE)

 (image/png)    


[ycs并发启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMjA4OTcwYzJhZjRmNTIxNmI3IiwicmVmX2lkIjoiNjczOTZlMjA1OTNmOTljOWZmMjM4MjUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwNjE3LCJleHAiOjE3ODI0NTcwMTd9.b22H4VUcuegJmkknP_zO9kOvL46ZYR2NvyUSnw5Ye8w)

 (image/png)    


[ycs非并发启动.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMjA4OTcwYzJhZjRmNTIxNmI4IiwicmVmX2lkIjoiNjczOTZlMjA1OTNmOTljOWZmMjM4MjUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwNjE3LCJleHAiOjE3ODI0NTcwMTd9.SNoJvb7LmGKXqzCoviEAox6cAkM_uD_oDud6f8XHCXc)

 (image/png)    


[部署ycr.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMjA4OTcwYzJhZjRmNTIxNmI5IiwicmVmX2lkIjoiNjczOTZlMjA1OTNmOTljOWZmMjM4MjUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwNjE3LCJleHAiOjE3ODI0NTcwMTd9.mSc90paJGIWW29rKLo7Jq7MH6GKSsvYcEyW9nc-VVms)

 (image/png)    


## Comments:

|  [](null)  ,评审纪要,  [【20240416】ycs多盘方案概要设计评审会议纪要 - 李垠 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150617148)  ,Posted by liyin at 四月 16, 2024 21:17|
|---|
|  [](null)  ,讨论会议纪要,  [【20240417】yfs管理ycs多盘方案会议纪要 - 李垠 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150619174)  ,Posted by liyin at 四月 17, 2024 19:45|

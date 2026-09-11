Created by 同二鹏, last modified on 九月 14, 2024

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

本需求来源于长沙银行POC场景：sysbench测试数据集40张表，单表5000万行数据。数据库内存分别设置48G、64G、72G、96G、128G五种配置场景下，设置多种不同的并发级别，分别是4、8、16、24、32、40、48、56、64、72、80、88、96、104、112、120、128个线程数，跑sysbench oltp测试，分别持续压测10分钟，交易延时不得超过100毫秒。单个并发内的测试数据波动率在某些情况下会出现非常大的波动。针对此场景需要优化，降低性能波动率，提高稳定性。

###   [1.2 需求分析](#12-需求分析)  

1. 此业务场景预期主要是批量插入，更新。单表5000W的数据量下，脏页产生的速度非常快。
1. 此业务场景的性能表现主要取决于data buffer申请耗时。当data buffer未满时，批量读写申请data buffer时耗时很短，只需要分配未使用的内存即可。当data buffer已满时，申请data buffer需要进行内存回收后才可以分配使用，此阶段相对耗时较长。
1. 当脏页刷盘速度小于脏页产生速度时，全局脏页会逐渐累积，data buffer申请时，内存回收耗时越来越长，导致性能逐渐下降。
1. 当脏页逐渐累积，占满整个data buffer，此时性能会骤然下降很低，脏页产生速度降低，脏页逐渐释放，性能又会上升，如此反复循环。


下图为多种并发连跑的性能结果

![](https://pingcode.yasdb.com/atlas/files/public/67396dfea1ad9a3311dc94a9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM0MDAsImV4cCI6MTc4MjMyNDIwMH0.66SyZsgFbIyhN6LpTXn9Ul6OEAZl8AvQr7KSbawOJKE)

既然此场景性能表现主要取决于data buffer情况，那么只需将性能骤变的场景通过机制平滑处理，即可降低性能波动率。通过以下几点策略可降低性能波动率。

- 为了降低性能波动率，需要限制脏页生产速度，不能让脏页产生过快，累积过多。
- 为了不影响小压力下的性能稳定性，只在data buffer满后进行data buffer流控
- data buffer流控需要持续动态调整，根据脏页情况做到自适应流控。


##   [2. 接口](#2-接口)  

###   [2.1 参数](#21-参数)  

ENABLE_TRAFFIC_CONTROL，隐藏参数，用于控制是否开启data buffer流控，取值：ON/OFF，默认值ON。

###   [2.3 统计项](#23-统计项)  

##   [3. 规格与约束](#3-规格与约束)  

无

##   [4. 特性](#4-特性)  

###   [4.1 流控策略](#41-流控策略)  

1. data buffer未满时，不进行流控
1. 定期检查脏页变化情况，当脏页较上次检查变多时，如果此次脏页增长率大于上次的脏页增长率，根据增长率加大相应的data buffer流控延迟；如果此次脏页增长率不大于上次的脏页增长率，维持之前的data buffer流控延迟。当脏页较上次检查减少时，根据脏页减少率减少相应的data buffer流控延迟。
1. 为了平滑毛刺，保留最近的十次data buffer流控延迟记录，使用平均值作为data buffer流控延迟值。


###   [4.2 线程设计](#42-线程设计)  

1. 使用后台线程定期计算data buffer流控延迟，可复用data buffer后台均衡线程


###   [4.3 数据结构](#43-数据结构)  

```
typedef struct stBpTrafficCtrl {
    CodDouble delayHist[BP_DELAY_HIST_CNT];   // 记录历史延迟
    CodUint32 delayHistHwm;                   
    CodUint32 delay;                          // data buffer流控延迟
    CodUint32 dirtylocks;                     // 记录上次流控计算的脏页数
    CodDouble ratio;                          // 记录上次流控计算的脏页变化率
    CodDate   time;                           // 记录上次流控计算的时间
} BpTrafficCtrl;

```

###   [4.4 流控延迟计算流程图](#44-流控延迟计算流程图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396dfe8970c2af4f521635/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM0MDAsImV4cCI6MTc4MjMyNDIwMH0.66SyZsgFbIyhN6LpTXn9Ul6OEAZl8AvQr7KSbawOJKE)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

数据库按照要求，配置不同data buffer内存，进行sysbench压测sysbench数据准备

```
./src/sysbench ./src/lua/oltp_read_write.lua --report-interval=10 --tables=40 --table_size=50000000 --yashan-db=192.168.27.32:1689
                                             --yashan-user=sysbench --yashan-password=sysbench --time=600 --threads=128 prepare

```

sysbench压测

```
#!/bin/sh
for i in 4 8 16 24 32 40 48 56 64 72 80 88 96 104 112 120 128
do
    sh ./runSysbench.sh $i
done

```

runSysbench.sh

```
#!/bin/bash
./src/sysbench ./src/lua/oltp_read_write.lua --report-interval=10 --tables=40 --table_size=50000000 --yashan-db=192.168.27.32:1689
                                             --yashan-user=sysbench --yashan-password=sysbench --time=600 --threads=$1 run

```

注：

1. 配置DBWR_COUNT=8或者16，提高脏页刷盘能力,同时_DATA_BUFFER_PARTS配置为DBWR_COUNT相同的数值


##   [6.资料设计章节](#6资料设计章节)  

配置参数动态视图

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2024-9-5_9-41-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmRhMWFkOWEzMzExZGM5NGE4IiwicmVmX2lkIjoiNjczOTZkZmQ1OTNmOTljOWZmMjM4MTNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNDAwLCJleHAiOjE3ODIzOTk4MDB9.rhrYddCEFeUEd4hNLV001cSJpZW_XLqQ4Fv5ALvwTc4)

 (image/png)    

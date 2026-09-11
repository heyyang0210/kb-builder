Created by 林俊喆, last modified by  罗继鸿 on 七月 16, 2023

##   [1. 概述](#1-概述)  

用于查询各节点间的1对1channel的传输性能统计。根据不同的测试场景和参数配置，其结果可能不同。

##   [2. 接口](#2-接口)  

```
select * from dv$channel_perf;

```

###   [表定义](#表定义)  

|ColumnName|DataType|Description|
|---|---|---|
|tab_queue_id|Smallint|表队列编号|
|channel_id|Samllint|通道编号|
|direction|Tinyint|方向，0或者1|
|src_port|SmallInt|发送端口号|
|dst_port|SmallInt|接收端口号|
|src_endpoint|SmallInt|发送节点|
|dst_endpoint|SmallInt|接收节点|
|active_time|Integer|激活时间，单位豪秒|
|send_bytes|Bigint|采样时间内发送的数据量，单位byte|
|send_packets|Integer|采样时间内发送包的个数|
|send_acks|Integer|采样时间内发送ack的个数|
|send_buffer_size|Integer|采样时发送缓存的大小，单位byte|
|send_window|Integer|采样时发送窗口的大小，单位包的个数|
|cong_window|Integer|采样时拥塞窗口的大小，单位包的个数|
|slow_starts|Integer|采样时滑动窗口重启次数，单位次|
|send_wind_limited|Integer|采样时间内因发送窗口限制而等待的次数|
|cong_wind_limited|Integer|采样时间内因拥塞窗口限制而等待的次数|
|wait_space_times|Integer|采样时间内因发送缓存不足而等待的次数|
|wait_space_timeout|Integer|采样时间内因发送缓存不足而等待超时的次数|
|round_trip_time|Integer|报文处理一个来回的评估时间|
|band_width|float|带宽，单位M/s|
|recv_bytes|Bigint|采样时间内接收的数据量，单位byte|
|recv_packets|Integer|采样时间内接收包的个数|
|recv_acks|Integer|采样时间内接收ack的个数|
|recv_buffer_size|Integer|采样时接收缓存的大小，单位byte|
|recv_window|Integer|采样时接收窗口的大小，单位包的个数|
|wait_data_times|Integer|采样时间内接收端因数据未到来而等待的次数|
|wait_data_timeout|Integer|采样时间内接收端因数据未到来而等待超时的次数|


>   通道为双工，一个channel_id会生成两条数据，其src_port和dst_port交换位置    每条记录的是以channel的发送端的视角的统计数据，即src_port的视角  

##   [3. 设计](#3-设计)  

###   [3.1 测试场景](#31-测试场景)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/07/13_17_58_49_20230713175842.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDUsImV4cCI6MTc4MjMwMDYwNX0.dzMMq5AP5JzMDuCsZT2Uq8QEUXqqVwdjMez4TXxWHp4)

以三节点（1CN2DN）为例，可以两个节点间的通道性能，也可以测试本地的通道性能，后续可考虑通过增加测试数据类型，覆盖更多的测试场景。

主要需要构造DN重分发，DN到CN的数据汇聚的场景

####   [3.1.1 DN重分发](#311-dn重分发)  

```
select count(*) from t1 group by id;

```

通过调整t1表的总行数和行distinct值可以构造DN的group by重分发，如果能控制节点上表的数据，可以定向构造某个节点到某个节点的重分发

  [统计信息修改文档](https://conf.yasdb.com/display/YAS/DBMS_STATS)  

####   [3.1.2 DN到CN的数据分发](#312-dn到cn的数据分发)  

```
select count(distinct(L_PARTKEY)) from lineitem;

```

沿用22.2的性能测试配置，对比两者的性能差距，需要明确两个版本的计划是相同的
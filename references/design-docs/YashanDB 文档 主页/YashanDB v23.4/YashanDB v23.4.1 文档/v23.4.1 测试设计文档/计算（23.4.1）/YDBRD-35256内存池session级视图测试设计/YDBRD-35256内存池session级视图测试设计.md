# 1. 概述

SR：  [https://pingcode.yasdb.com/pjm/items/6707338de489dd0868f344d4?#YDBRD-33719 内存池统一](https://pingcode.yasdb.com/pjm/items/67330db0e489dd08680843c0?)  

#YDBRD-35256 MEX_POOL和APP_POOL内存池SESSION级视图

开发设计文档：  [https://pingcode.yasdb.com/wiki/spaces/TANGJIAXIN/pages/6739a37c728206efb930671e](https://pingcode.yasdb.com/wiki/spaces/TANGJIAXIN/pages/6739a37c728206efb930671e)  

该需求为heap表执行内存新增session级视图，新增2个单机视图为：v$mex_session_state，v$mex_session_tag_state，分布式和 集群部署为：gv$mex_session_state,gv$mex_session_tag_state（多3个字段）

# 2. 需求分析

## 2.1 功能点分析

（1）  **v$mex_session,gv$mex_session**

|  
|列名|类型|说明|测试场景|
|---|---|---|---|---|
|1|sid|smallint|session id|结合v$sql,v$session查询当前执行的sql所用的内存|
|2|max_hold_size|bigint|允许持有的最大内存（字节）|写死|
|3|hold_size|bigint|持有的内存（字节）|一个会话执行sql，另一个会话查询视图，可以观察前者的当前内存使用状态|
|4|using_size|bigint|使用中的内存（字节）||
|5|unused_size|bigint|未使用的内存（字节）||
|6|total_alloc_times|bigint|历史分配次数（1条sql可能分配释放多次）|会话执行完一系列sql之后，可以查询视图，查看历史使用内存的统计信息|
|7|total_alloc_size|bigint|历史分配内存（字节）||
|8|total_free_times|bigint|历史释放次数||
|9|total_free_size|bigint|历史释放内存（字节）||
|10|total_fill_times|bigint|历史填充缓存次数（未命中次数）||
|11|total_gc_times|bigint|历史垃圾清理次数||


相关规则：

1. 各个会话的hold_size之和小于等于各个area的using_size之和
1. 各个会话的hold_size之和小于等于base的using_size
1. hold_size <= max_hold_size
1. using_size + unused_size == hold_size
1. total_alloc_size >= total_free_size
1. total_fill_times <= total_alloc_times，total_fill_times / total_alloc_times，比值可以衡量缓存命中率，比值一定小于1


使用场景：

1. 租户管理，可用查看所有session的内存使用情况，方便识别哪些占了大量资源的会话
1. 性能调优，可查看session会话的累计mHandle缓存命中率，total_fill_times / total_alloc_times，命中率越高，性能越好
1. 性能调优，可查看垃圾回收的次数（total_gc_times），  观察垃圾回收是否会造成性能波动  ，内存每释放81920次就会触发一次gc
1. 问题定位，当怀疑存在内存泄漏时，可观察session的使用中内存是否在一直上涨
1. 问题定位，当报错内存不足时，可观察当前可使用的内存大小，结合v$mex_pool_module视图（name字段），定位出现内存不足的原因
1. 问题定位，当出现内存分配不均时，可观察哪个会话占用过多内存资源，从而针对性优化


session 退出后视图记录数据删除

（2）  **v$mex_session_module,gv$mex_session_module**

|  
|列名|类型|说明|测试场景|
|---|---|---|---|---|
|1|sid|smallint|session id||
|2|tag_id|integer|tag id||
|3|name|varchar(64)|tag的名称，例如hash join，hash group by，order by，app mem等||
|4|using_size|bigint|使用中的内存（字节）||
|5|total_alloc_times|bigint|历史分配次数||
|6|total_alloc_size|bigint|历史分配大小（字节）||
|7|total_free_times|bigint|历史释放次数||
|8|total_free_size|bigint|历史释放大小（字节）||


相关规则：

1. name字段：目前只有OTHER，APP MEM INIT（线程独有），APP MEM EXTEND（线程之间共享）三个，具体构造场景？？
1. 因为有跨语句的内存申请释放，所以total_alloc_size不一定等于total_free_size


使用场景：

1. 性能调优，可以分析一条sql中，内存各种用途使用量的占比，若有不合理的情况，可以针对性调优
1. 问题定位，可以根据一条sql各内存使用量，分析算子采用了什么算法，从而定位性能差的原因（暂未实现的功能）


以上2个视图重启后历史数据清空，无业务执行的情况下，当前内存有少量内存

## 2.2 应用场景

2.1中有描述

# 3. 详细测试设计

## 3.1 测试设计方法

场景法，组合法

## 3.2 详细测试设计

|视图公共测试点|desc 查看字段信息是否符合预期|字段名称，字段类型，字段顺序||
|---|---|---|---|
||ddl,dml拦截|![image.png](https://pingcode.yasdb.com/atlas/files/public/674ec2f3a1ad9a3311de3e4c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBZ0FBQUFCQUNBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk5MTIsImV4cCI6MTc4MjQ3MDcxMn0.jD61kqMk1KLDsPt9EfZM2arpyW1YhsYJC6TW9en06ng)||
||视图权限|![image.png](https://pingcode.yasdb.com/atlas/files/public/674ec307a1ad9a3311de3e4d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBZ0FBQUFCQUNBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk5MTIsImV4cCI6MTc4MjQ3MDcxMn0.jD61kqMk1KLDsPt9EfZM2arpyW1YhsYJC6TW9en06ng)||
||视图过滤等功能|||
|视图规则检查|各个会话的hold_size之和小于等于各个area的using_size|10个窗口并发执行dml的同时另一个窗口查询视图, ,多少session个并发查出来就有多少条结果，窗口退出后，视图中没有结果||
||各个会话的hold_size之和小于等于base的using_size|||
||1. hold_size <= max_hold_size
1. using_size + unused_size == hold_size
|||
||1. total_alloc_size >= total_free_size
1. total_fill_times <= total_alloc_times
1. total_fill_times / total_alloc_times<1 
|dml执行完之后查询视图后有数据||
|场景测试|tag_id的3种场景构造：OTHER，APP MEM INIT，APP MEM EXTEND|||
||触发total_gc_times，观察性能|测试相同sql在有无垃圾清理的时候性能区别有多大||
||同一条sql执行2次|v$mex_session_state，v$mex_session_tag_state视图中的历史相关字段有增多，理论上增加的内存是相同的||
||是否有与其他视图共同使用的场景？|（1）结合v$sql,v$session查询当前执行的sql所用的内存；,v$global_mpool(全局)||
|视图内存泄漏|循环查询视图 hash join anti/semi   |预期视图查询结果变动不大||
|锁v$spinlock构造相关场景||||


## 3.3 专项

|系统级DFX分类|是否涉及|
|---|---|
|CT|视图查询与相关业务并发，预期视图查询正确，业务不core,不卡|
|KT|视图查询与相关业务并发，预期视图查询正确，业务不core,不卡|
|长稳|多次稳定运行，视图不涉及长稳|
|一致性|不涉及，视图不涉及一致性|
|三方测试工具  
(sqltest，sqlancer)|不涉及，该需求不涉及sql语法层面的新增\修改|
|安全|不涉及，该需求不涉及用户密码\用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|是，考虑故障场景下的视图查询|
|HA|是，考虑主备均可查，主备切换后均可查|
|压力|不涉及，此次测试不考虑压力专项|
|性能|是，tpcc性能不下降|
|可维护性|不涉及，该需求增加新视图，没有增加错误码日志相关代码|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；




# 5. 测试框架设计

部分场景可通过YTP自动化看护，部分上到不稳定用例中

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估


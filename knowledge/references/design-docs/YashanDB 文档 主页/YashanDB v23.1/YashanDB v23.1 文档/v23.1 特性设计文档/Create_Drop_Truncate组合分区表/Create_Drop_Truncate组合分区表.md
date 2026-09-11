Created by 未知用户 (zengzhaohan), last modified by  江祉涵 on 四月 26, 2023

##   [一、功能](#一功能)  

组合分区的一级和二级分区类型有很多种不同的组合，主要是要定义四部分信息：

- partition by : 一级分区类型和分区键列
- subpartition by: 二级分区类型和分区键列
- subpartition: 二级分区具体的分区定义
- partition：一级分区具体的分区定义其中不需要完整定义每个一级分区的二级分区，可以通过二级分区模板来简化定义，每个一级分区的二区分区都会按照模型进行定义。


没有指定template，也没有指定二级分区的情况:

- 如果二级分区是range，默认创建一个high value bound全部是max value的二分区
- 如果二级分区是list, 默认创建一个high value bound为default的二级分区
- 如果二级分区是hash, 默认只创建一个二级hash分区


|功能|是否支持|
|---|---|
|hash-*组合分区|√|
|list-*组合分区|√|
|range-*组合分区|√|
|interval-*组合分区|×（以后会支持）|
|子分区模板|√|
|子分区指定表空间|√|
|子分区指定segment creation immediate/deferred|√|
|子分区指定物理属性initrans, maxtrans, pctfree|× （不支持）|
|drop组合分区表|√|
|truncate组合分区表|√|


##   [二、限制](#二限制)  

与一级分区相同：    [一级分区create约束](https://conf.yasdb.com/display/YAS/Create+Partition+Table#%E4%B8%80%E7%BA%A6%E6%9D%9F)  

- 同张表的所有分区(包括一级分区、二级分区互相之间)不能重名
- 同张表所有的二级分区数量之和不能超过1048575（2^20-1）


|分区类型|约束|
|---|---|
|range|values不能为NULL|
||partition name不能重复|
||values必须递增|
||values数量必须和partition key一致|
|list|partition name不能重复|
||values不能重复|
||default partition必须定义在最后|
||values数量必须和partition key一致|
||partition bound element必须是string, datetime, number，int或者NULL|
|hash|partition name不能重复|
||partition quantity不能超过上限2^20-1|
|分区列|partition key的最大为column数量16|
||partition key column必须是table定义的column子集|
||partition key中的column不能重复|
||partition key column的类型必须为数值(int, number, float, double)，字符(char, varchar, nchar, nvarchar), 时间(date, timestamp, interval), boolean。|


##   [三、用例](#三用例)  

|分区类型|测试场景|用例|输出结果|
|---|---|---|---|
|hash-hash,  
,  
|子分区只指定分区数,(quantity)|create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartitions 8    
  (partition p1, partition p2);|能查到16个子分区。|
||segment creation immediate/deferred|create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartitions 8    
  (partition p1(subpartition sub1 segment creation immediate), partition p2);|成功。|
||子分区指定表空间|create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartitions 8 store in (users, system)    
  partitions 2 store in (users);|能查到16个子分区。,子分区交替存放在users，system表空间里。|
||子分区使用模板|create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sp1 tablespace system, subpartition sp2 tablespace users)    
  (partition p1, partition p2);|能查到4个子分区。,能查到模板。|
||指定表空间，initrans, maxtrans, pctfree信息|create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sp1 tablespace users pctfree 10 initrans 8 maxtrans 100, subpartition sp2)    
  (partition p1, partition p2);|在Oracle19c中二级分区没法指定initrans, maxtrans, pctfree信息。为啥？|
||只定义部分子分区|create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sp1 tablespace system, subpartition sp2 tablespace users)    
  (partition p1(subpartition p1_sp1, subpartition p1_sp2, subpartition p1_sp3),    
  partition p2, partition p3(subpartition p3_sp1, subpartition p3_sp2));|能查到7个子分区，p1的3个在默认表空间里，p2有2个，p3有2个。,能查到模板。|
||drop表|drop table hh_composite;|查不到表相应的分区和模板|
||truncate表|truncate table hh_composite;|表中无数据|
|hash-list|子分区有default|create table hl_composite(c1 int, c2 varchar(10))    
  partition by hash(c1)    
  subpartition by list(c2)    
  (partition p1(subpartition sp1 values('a')), partition p2 (subpartition sp3 values('d'), subpartition sp4 values(default)));|能查到3个子分区|
||子分区指定表空间|create table hl_composite(c1 int, c2 varchar(10))    
  partition by hash(c1)    
  subpartition by list(c2)    
  (partition p1(subpartition sp1 values('a') tablespace users), partition p2 (subpartition sp3 values('d'), subpartition sp4 values(default) tablespace users));|1个在默认表空间，2个在users表空间|
||子分区使用模板|create table hl_composite(c1 int, c2 varchar(10)) partition by hash(c1) subpartition by list(c2)    
  subpartition template(subpartition sp1 values('a'), subpartition sp2 values(default))    
  partitions 8;|能查到16个子分区。模板2个子分区。|
||只定义部分子分区|create table hl_composite(c1 int, c2 varchar(10))    
  partition by hash(c1)    
  subpartition by list(c2)    
  subpartition template(subpartition sp1 values('a'), subpartition sp2 values(default))    
  (partition p1(subpartition sp1 values('a') tablespace users), partition p2, partition p3);|4个子分区。模板2个子分区|
|hash-range|子分区有MAXVALUE|create table hr_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than ('a') , subpartition sub2 values less than (MAXVALUE))    
  (partition p1,partition p2);|4个子分区|
||子分区使用模板|create table hr_composite(a int, b int)    
  partition by hash(a)    
  subpartition by range(b)     
  SUBPARTITION TEMPLATE    
  (    
  subpartition sp1 values less than (10),    
  subpartition sp2 values less than (20)    
  )    
  partitions 32;|64个子分区|
||只定义部分子分区|create table hl_composite(a int, b int, c int,d int)    
  partition by hash(a)    
  subpartition by range(b,c,d)     
  (    
  partition p1    
  (    
  subpartition sp1 values less than(10,20,30),    
  subpartition sp2 values less than(20,20,30)    
  ),    
  partition p2    
  );|3个子分区|
|list-hash|子分区只指定分区数,(quantity)|create table lh_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by hash(b)    
  subpartitions 8    
  (partition p1 values(10), partition p2 values(DEFAULT));|能查到16个子分区|
||子分区使用模板|create table lh_composite(a int, b int)    
  partition by list(a)    
  subpartition by hash(b)     
  subpartition template    
  (    
  subpartition sp1,    
  subpartition sp2    
  )    
  (    
  partition p1 values(1),    
  partition p2 values(2)    
  );|4个子分区|
||只定义部分子分区|create table lh_composite(a int, b int)    
  partition by list(a)    
  subpartition by hash(b)     
  subpartition template    
  (    
  subpartition sp1,    
  subpartition sp2    
  )    
  (    
  partition p1 values(1),    
  partition p2 values(2) (subpartition sp3)    
  );|3个子分区|
|list-list|详细定义每个一级分区的二级分区|create table ll_composite(a int, b int)    
  partition by list(a)    
  subpartition by list(b)     
  (    
  partition p1 values(1)    
  (    
  subpartition sp1 values(1),    
  subpartition sp2 values(2)    
  ),    
  partition p2 values(2)    
  (    
  subpartition sp3 values(1),    
  subpartition sp4 values(2)    
  )    
  );|  
|
||子分区使用模板|create table ll_composite(a int, b int)    
  partition by list(a)    
  subpartition by list(b)     
  subpartition template    
  (    
  subpartition sp1 values(1),    
  subpartition sp2 values(2)    
  )    
  (    
  partition p1 values(1),    
  partition p2 values(2)    
  );|  
|
|list-range|详细定义每个一级分区的二级分区|create table lr_composite(a int, b int)    
  partition by list(a)    
  subpartition by range(b)     
  (    
  partition p1 values(1)    
  (    
  subpartition sp1 values less than(10),    
  subpartition sp2 values less than(20)    
  ),    
  partition p2 values(2)    
  (    
  subpartition sp3 values less than(10),    
  subpartition sp4 values less than(20)    
  )    
  );|  
|
||子分区使用模板|create table lh_composite(a int, b int)    
  partition by list(a)    
  subpartition by range(b)     
  subpartition template    
  (    
  subpartition sp1 values less than(10),    
  subpartition sp2 values less than(20)    
  )    
  (    
  partition p1 values(1),    
  partition p2 values(2)    
  );|  
|
|range-hash|详细定义每个一级分区的二级分区|create table rh_composite(a int, b int)    
  partition by range(a)    
  subpartition by hash(b)     
  (    
  partition p1 values less than(1)    
  (    
  subpartition sp1,    
  subpartition sp2     
  ),    
  partition p2 values less than(2)    
  (    
  subpartition sp3,    
  subpartition sp4    
  )    
  );|  
|
||子分区使用模板|create table rr_composite(a int, b int)    
  partition by range(a)    
  subpartition by hash(b)     
  subpartition template    
  (    
  subpartition sp1,    
  subpartition sp2    
  )    
  (    
  partition p1 values less than(1),    
  partition p2 values less than(2)    
  );|  
|
||只定义部分子分区|create table rr_composite(a int, b int)    
  partition by range(a)    
  subpartition by hash(b)     
  subpartitions 32    
  (    
  partition p1 values less than(1),    
  partition p2 values less than(2)    
  );|  
|
|range-list|详细定义每个一级分区的二级分区|create table rl_composite(a int, b int)    
  partition by range(a)    
  subpartition by list(b)     
  (    
  partition p1 values less than(1)    
  (    
  subpartition sp1 values(10),    
  subpartition sp2 values(20)    
  ),    
  partition p2 values less than(2)    
  (    
  subpartition sp3 values(10),    
  subpartition sp4 values(20)    
  )    
  );|  
|
||子分区使用模板|create table rl_composite(a int, b int)    
  partition by range(a)    
  subpartition by list(b)     
  subpartition template    
  (    
  subpartition sp1 values(10),    
  subpartition sp2 values(20)    
  )    
  (    
  partition p1 values less than(1),    
  partition p2 values less than(2)    
  );|  
|
|range-range|详细定义每个一级分区的二级分区|create table rr_composite(a int, b int)    
  partition by range(a)    
  subpartition by range(b)     
  (    
  partition p1 values less than(1)    
  (    
  subpartition sp1 values less than(10),    
  subpartition sp2 values less than(20)    
  ),    
  partition p2 values less than(2)    
  (    
  subpartition sp3 values less than(10),    
  subpartition sp4 values less than(20)    
  )    
  );|  
|
||子分区使用模板|create table rr_composite(a int, b int)    
  partition by range(a)    
  subpartition by range(b)     
  subpartition template    
  (    
  subpartition sp1 values less than(10),    
  subpartition sp2 values less than(20)    
  )    
  (    
  partition p1 values less than(1),    
  partition p2 values less than(2)    
  );|  
|


## Comments:

|  [](null)  ,1. 列表拦截
1. 补充语法资料
,Posted by zengzhaohan at 四月 17, 2023 15:02|
|---|

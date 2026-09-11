*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/66e24a1889f961f330114ce8?](https://pingcode.yasdb.com/ship/ideas/66e24a1889f961f330114ce8?)  

#YASHAN-3321  AWR功能WRH$系统表调整为分区表

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/671898dbe489dd0868fd0149?](https://pingcode.yasdb.com/pjm/items/671898dbe489dd0868fd0149?)  

#YDBRD-34625 AWR功能WRH$系统表调整为分区表

##   [1. 总述](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#1-overview%E6%A6%82%E8%BF%B0)  

当前AWR相关系统表虽然被定义成分区表，但只有一个MAXVALUE的range分区，数据都存在一个分区，在delete时性能较差。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求来源：

内部需求



场 景：

1、当前AWR功能WRH$系统表清理快照是使用delete操作，这样性能上较慢，需要修改为drop分区减少undo使用量提升性能



需求描述：

AWR功能WRH$系统表调整为分区表



需求范围：

1、单机、集群



###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [(496) AWR系统表调整为interval分区调研 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/QINQIUTING/pages/67446f8e728206efb9341489)  

总结：

1.oracle的AWR相关系统表定义为范围分区，新数据存放在WRH$_SQLSTAT_3045944230_MXSN分区，当数据插入到到一定步长后，拓展出一个新分区存放原来的数据。

划分分区的算法可推导为：

大于(保存时间内的快照总份数 / 5 )的最小偶数，下限50



###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|AWR相关系统表调整为分区表|当前系统表定义不变，数据存放在MAXVALUE分区，当数据增长到一定步长时划分出一个新分区保存原来的数据|是|是|
||通过drop分区来删除快照|指定删除快照的范围若包含整块分区的数据则直接drop分区，否则还是delete|是|是|
|性能|删除快照场景性能将得到一定提升|通过drop分区来删除快照|是|是|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

**无**

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

无

##   [2. 接口](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**   SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

无

##   [3. 规格与约束](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#3-interfaces%E6%8E%A5%E5%8F%A3)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**   规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

无

##   [4. 特性](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

###   [4.1 AWR相关系统表调整为分区表](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#51-architecture%E6%9E%B6%E6%9E%84)  

1.当前快照信息系统表定义不变，需要划分分区的系统表包含：

|表名|描述|是否划分分区|备注|
|:---|:---|---|:---|
|WRM$_DATABASE_INSTANCE|数据库重启的信息|否|  
|
|WRM$_WR_CONTROL|快照信息控制表|否||
|WRM$_SNAPSHOT|快照信息|否|当前不是分区表，不支持调整为分区表  
|
|WRH$_MEM_USED_COMP|公共堆内存池/SQL缓存池/字典缓存池的内存使用情况|是|  
|
|WRH$_SERVICE_WAIT_CLASS|等待事件类统计信息|是|  
|
|WRH$_SYSTEM_EVENT|等待事件统计信息|是|当前索引不是local索引，升级时需删除重建  
|
|WRH$_SYSSTAT|系统统计项信息|是|  
|
|WRH$_OSSTAT|操作系统统计信息|是|  
|
|WRH$_SQLSTAT|sql统计信息|是|  
|
|WRH$_SQLTEXT|sql文本信息|是|  
|
|WRH$_CLUSTER_INFO|集群信息|是|集群专用|
|WRH$_CLUSTER_TASK_STAT|集群任务统计信息|是|集群专用|
|WRH$_CLUSTER_MESSAGE_STAT|集群收发信息|是|集群专用|




2.WRM$_WR_CONTROL系统表新增字段MOST_RECENT_SPLIT_ID	（NUMBER)、MOST_RECENT_SPLIT_TIME(NUMBER)记录划分分区时的snap_id和时间；

3.划分分区的规则：or

  3.1 （当前系统时间 - MOST_RECENT_SPLIT_TIME ）>=  1天；

  3.2  大于(保存时间内的快照总份数 / 5 )的最小偶数 （和oracle一样）或者  根据间隔时间算出的一天会保存的快照份数 下限50



4.划分分区时加上排他表锁（当前我们没有分区粒度的锁，oracle加的是分区排他锁），不断等待直至可对表进行加锁：

LOCK TABLE SYS.WRM$_SNAPSHOT IN EXCLUSIVE MODE;

alter table WRH$_MEM_USED_COMP split partition WRH$_MEM_USED_COMP_MXDB_MXSN at (DBID, snap_id) into (partition WRH$_MEM_USED_COMP_MXDB_snap_id, partition WRH$_MEM_USED_COMP_MXDB_MXSN tablespace SYSAUX) update indexes;

此处加表锁考虑的是ddl虽然也会给表加表锁，但是加锁时的等待时间可通过配置参数DDL_LOCK_TIMEOUT进行配置并且默认为0，此处只依靠ddl本身的表锁无法确定执行该ddl后的行为。



5.放开sys用户alter系统表的权限/放开sys用户操作awr系统表的部分权限（最小范围放开）。当前拦截了所有用户alter系统表的操作。



###   [4.2 删除快照](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

1.遍历每张表指定删除快照的范围，若包含整块分区的数据则直接drop分区，drop分区时加上排他表锁，也是不断等待直至可对表进行加锁：

LOCK TABLE SYS.WRM$_SNAPSHOT IN EXCLUSIVE MODE；

ALTER TABLE SYS.WRM$_SNAPSHOT DROP PARTITION partition_name；

2.drop分区后DELETE一遍需要删除的分区范围：

DELETE FROM SYS.WRM$_SNAPSHOT WHERE dbid = :dbid AND snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id;

3.delete之后遍历一遍快照范围内的分区是否有空分区，有则drop：

select count(*) into rows_num from SYS.WRM$_SNAPSHOT partition partition_name;

```
function drop_snapshot_partition(
  table_name      IN varchar(64)
  ) return boolean IS
  p_partition_name varchar(64);
BEGIN
      begin
        execute immediate 'LOCK TABLE SYS.'||table_name||' IN EXCLUSIVE MODE';
      exception
        when OTHERS then
          return FALSE;               
      end; 
      begin
        select partition_name into p_partition_name from dba_tab_partitions where partition_name like '%'|| table_name ||'%' and CAST(high_value AS NUMBER DEFAULT '' ON CONVERSION ERROR) = right_high_value;
      exception
        when NO_DATA_FOUND then
          commit;
          return TRUE;               
      end;
      execute immediate 'ALTER TABLE SYS.'||table_name||' DROP PARTITION ' || p_partition_name;
      return TRUE; 
END;

function drop_snapshot_partitions(
  right_high_value      IN NUMBER,
  ) return boolean;
BEGIN
      if drop_snapshot_partition('WRH$_MEM_USED_COMP') = FALSE then
        return FALSE; 
      endif;
      if drop_snapshot_partition('WRH$_SERVICE_WAIT_CLASS') = FALSE then
        return FALSE; 
      endif;
      if drop_snapshot_partition('WRH$_SYSTEM_EVENT') = FALSE then
        return FALSE; 
      endif;
      if drop_snapshot_partition('WRH$_SYSSTAT') = FALSE then
        return FALSE; 
      endif;
      if drop_snapshot_partition('WRH$_OSSTAT') = FALSE then
        return FALSE; 
      endif;
      if drop_snapshot_partition('WRH$_SQLSTAT') = FALSE then
        return FALSE; 
      endif;
      if drop_snapshot_partition('WRH$_SQLTEXT') = FALSE then
        return FALSE; 
      endif;
      return TRUE;
END;

--drop_snapshot_range
i := real_low_snap_id;
WHILE i <= real_high_snap_id LOOP
   begin
     select high_value into left_high_value from dba_tab_partitions where partition_name like '%WRH$_SQLTEXT%' and CAST(high_value AS NUMBER DEFAULT '' ON CONVERSION ERROR) <= i order by CAST(high_value AS NUMBER DEFAULT '' ON CONVERSION ERROR) limit 1;
   exception
     when OTHERS then
        left_high_value := 0;                
   end;
   begin
     select high_value into right_high_value from dba_tab_partitions where partition_name like '%WRH$_SQLTEXT%' and CAST(high_value AS NUMBER DEFAULT '' ON CONVERSION ERROR) > i order by CAST(high_value AS NUMBER DEFAULT '' ON CONVERSION ERROR) limit 1;
   exception
     when OTHERS then
        right_high_value := 1E126;                
   end;
   
   if left_high_value >= real_low_snap_id and right_high_value <= real_high_snap_id then
      if drop_snapshot_partition(right_high_value) = FALSE then
         i := i;
         continue;
      endif;
   endif;
   i :=  right_high_value;
END LOOP;

execute immediate 'DELETE FROM SYS.WRH$_MEM_USED_COMP WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRH$_SERVICE_WAIT_CLASS WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRH$_SYSTEM_EVENT WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRH$_SYSSTAT WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRH$_OSSTAT WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRH$_SQLSTAT WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRH$_SQLTEXT WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
execute immediate 'DELETE FROM SYS.WRM$_SNAPSHOT WHERE dbid = :dbid AND  snap_id >= :real_low_snap_id AND snap_id <= :real_high_snap_id' USING p_dbid,real_low_snap_id,real_high_snap_id;
commit;

i := real_low_snap_id;
WHILE i <= real_high_snap_id LOOP
   begin
     select high_value into left_high_value from dba_tab_partitions where partition_name like '%WRH$_SQLTEXT%' and high_value <= i order by high_value limit 1;
   exception
     when OTHERS then
        left_high_value := 0;                
   end;
   begin
     select partition_name, high_value into partition_name,right_high_value from dba_tab_partitions where partition_name like '%WRH$_SQLTEXT%' and high_value > i order by high_value limit 1;
   exception
     when OTHERS then
        right_high_value := 1E126;                
   end;
   
   if right_high_value != 1E126 then
      begin
        execute immediate 'select count(*) into rows_num from SYS.WRM$_SNAPSHOT partition ' || partition_name;
      exception
        when OTHERS then
          i :=  right_high_value;
          continue;                
      end;        
      if rows_num = 0 then
         drop_snapshot_partition(right_high_value);
      endif;
   endif;
   i :=  right_high_value;
END LOOP;

```

###   [4.3 升级](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

1.WRM$_WR_CONTROL系统表新增字段MOST_RECENT_SPLIT_ID	(NUMBER)、MOST_RECENT_SPLIT_TIME(NUMBER)；

2.需要划分分区的系统表定义不变，在升级后首次创建快照时划分出新分区保存原数据，因此删除升级前的快照性能还是会比较慢。

3.WRH$_SYSTEM_EVENT表删除索引重建：

alter table WRH$_SYSTEM_EVENT DROP CONSTRAINT WRH$_SYSTEM_EVENT_PK DROP INDEX;

alter table SYS.WRH$_SYSTEM_EVENT 

add constraint WRH$_SYSTEM_EVENT_PK primary key (DBID, SNAP_ID, INSTANCE_NUMBER, EVENT_ID) using index local tablespace SYSAUX;



##   [5. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

|测试场景|预期|备注|
|---|---|---|
|默认间隔时间下，自动创建快照划分的分区步长|步长为24||
|默认间隔时间和保存时间下，手动创建快照划分的分区步长|步长符合划分分区算法||
|默认间隔时间和保存时间下，一部分自动一部分手动创建快照划分的分区步长|步长符合划分分区算法||
|调整间隔时间和保存时间，自动创建快照划分的分区步长|步长符合划分分区算法||
|调整间隔时间和保存时间，手动创建快照划分的分区步长|步长符合划分分区算法||
|调整间隔时间和保存时间，一部分自动一部分手动创建快照划分的分区步长|步长符合划分分区算法||
|删除快照范围不包含一整个分区|只涉及delete，delete后如果分区为空则drop掉分区，考虑增加打骈观察||
|删除快照范围包含整个分区|drop分区后delete||
|删除快照范围一部分包含整个分区，一部分不包含|drop分区后delete，delete后如果分区为空则drop掉分区||
|创建快照和创建快照并发，都涉及划分分区|一个会话划分分区成功，另一个等待插入数据，最终返回成功||
|删除快照和删除快照并发，都涉及drop分区|一个会话drop分区成功，另一个会话等待加锁成功后发现分区已经被drop则不会再drop，最终返回成功||
|创建快照和删除快照并发，涉及划分分区，或者涉及drop分区|创建快照需要划分分区时，删除快照需要等待，性能会稍稍下降；,删除快照需要drop分区时，创建快照需要等待，性能会稍稍下降||




##   [6. 资料设计章节](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#7-document%E8%B5%84%E6%96%99)  

无，内部调整

##   [7. 未来规划](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1.支持分区粒度的锁后对此需求加的表锁可更改为分区锁，当前表锁会影响创建快照和删除快照并发时的性能，如果加分区锁，则不会相互影响。
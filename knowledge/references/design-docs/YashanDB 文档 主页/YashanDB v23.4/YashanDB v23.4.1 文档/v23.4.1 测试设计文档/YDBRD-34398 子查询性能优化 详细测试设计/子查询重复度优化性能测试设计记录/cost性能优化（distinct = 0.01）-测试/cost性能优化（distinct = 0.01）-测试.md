Created by 刘清萍, last modified on 十一月 14, 2024

### 1.1000w行数据，distinct=0.01测试结果：

版本75a7875416

表1插入1000万行数据，该表中设定一些字段与其他三个表进行关联，插入数据时与其他表关联的列的重复值比例为0.01，第二个表插入1038行数据，第三个表插入335行数据，第4个表插入216条数据。

  点击此处展开...

|序号|场景|测试场景语句（distinct=0.1）|br23.2 SQL执行时间（/s）|br23.2 带优化的SQL执行时间（/s）|master 带优化的SQL执行时间（/s）|master 带优化的SQL执行时间（/s）|oracle执行时间（/s）|提升效率：（未优化/优化）|带优化的与oracle时间相差：（带优化/oracle）|
|:---|:---|:---|:---|:---|:---|---|:---|---|:---|
||||alter session set subquery_ndv_factor = 0;|alter session set subquery_ndv_factor = 1;|alter session set subquery_ndv_factor = -1;|alter session set subquery_ndv_factor = 0;|  
|  
|  
|
|1|in后为静态子查询|select count(*) from bal_detail_000 t1 where taaccountid in (select taaccountid from bal_frozen_detail_000 t2 where SHARETYPE='B' and unfrozenflag = 'N' and DISTRIBUTORCODE<200);|1.751    
  1.757    
  1.728    
  **均值:1.745**,  
,  
|1.758    
  1.829    
  1.77    
  **均值:1.786 **    
|  
3s|3s  
|0.92  
1.02
0.92
  **均值：0.953**|0.977 |1.609 |
|2|c1 not in子查询在where之后,有多个外部表达式|select count(*)    
  from (    
  select * from (    
  select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000) t1    
  where (t1.distributorcode is not null)     
  and fundcode not in    
  (select fundcode     
  from     
  ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode));|18.443    
  18.417    
  18.317    
  **均值:18.392 **    
    
    
|18.996    
  18.561    
  18.497    
  **均值:18.685 **    
|5.8s||1.39  
1.38
1.38
  **均值：**  1.383|0.984 |11.627 |
|3|(c1,c2) in子查询在where之后,有多个投影列和多个外部表达式|select count(*)    
  from bal_detail_000 t1     
  where (t1.distributorcode > 200)     
  or (taaccountid,fundcode) in    
  (select taaccountid,fundcode     
  from     
  ACCT_LOANING_CLEAR t2 where t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode);|19.165    
  19.270    
  19.115    
  **均值:19.183 **    
|19.289    
  19.237    
  19.177    
  **均值:19.234 **    
|5.6s|走优化  5.7s|1.43  
1.41
1.42
  **均值：**  1.420|0.997 |11.587 |
|4|子查询在where之后,join在子查询中|select count(*)    
  from    
  (select tano,taaccountid,distributorcode,branchcode,fundcode,    
  max(case when BALSTATUS='0' then 1 else 0 end)as a,    
  max(case source when '2' then LASTFUNDVOL else 0 end) as b,    
  avg(fundvol) as su    
  from bal_detail_000     
  group by tano,taaccountid,distributorcode,branchcode,fundcode) t1     
  where (distributorcode > 200) or a     
  in (select BALSTATUS     
  from     
  bal_detail_000 t2     
  inner join bal_frozen_detail_000 t3 on t2.tano=t3.tano    
  inner join cfg_realtfundseatagency_clear t4 on t1.fundcode=t4.fundcode    
  inner join acct_loaning_clear t5 on t1.distributorcode=t5.distributorcode    
  where t4.DISTRIBUTORCODE>=75);|8.307    
  8.300    
  8.291    
  **均值:8.299 **    
|8.393    
  8.306    
  8.299    
  **均值:8.333 **    
|10.8|9.6s|1.67  
1.66
1.67
  **均值：**  1.667|0.996 |1.656 |
|5|子查询在where之后,join在子查询外|select count(*) FROM    
  (SELECT t1.taaccountid,t1.distributorcode,t1.branchcode,t1.transactionaccountid,t1.fundcode,t1.taserialno FROM    
  bal_detail_000 t1    
  LEFT JOIN bal_frozen_detail_000 t2     
  on    
  t2.fundcode = t1.fundcode    
  AND    
  t2.taaccountid = t1.taaccountid    
  AND    
  t2.origintaserialno = t1.taserialno WHERE t2.unfrozenflag = 'N') t    
  WHERE    
  (t.distributorcode = '205' and substr(t.transactionaccountid, 14, 1) = 1)    
  OR DISTRIBUTORCODE in (    
  select DISTRIBUTORCODE from cfg_realtfundseatagency_clear a    
  where a.distributorcode = t.distributorcode    
  and a.fundcode = t.fundcode);|2.397    
  2.394    
  2.386    
  **均值:2.392 **    
|2.395    
  2.405    
  2.39    
  **均值:2.397 **    
|-1,没走优化  3.5s|走优化  3.5s|1.72  
1.71
1.72
  **均值：**  1.717|0.998 |2.864 |
|6|exists后为静态子查询,(只会执行一次，与基准版本相比较)|select count(*) from bal_detail_000 t1 where exists (select taaccountid from bal_frozen_detail_000 t2 where SHARETYPE='B' and unfrozenflag = 'N' and DISTRIBUTORCODE<200);    
|1.196    
  1.216    
  1.214    
  **均值:1.209 **    
|1.219    
  1.219    
  1.237    
  **均值:1.225 **    
|  
2.4s|  
18.2|5.07  
4.96
4.83
  **均值：**  4.953|0.987 |2.803 |
|7|简单exists子查询，在where之后,有多个外部表达式|select count(*)    
  from bal_detail_000 t1    
  where t1.distributorcode !=0 or exists    
  (select taaccountid     
  from bal_frozen_detail_000 t2 where t1.taaccountid = t2.taaccountid and t1.fundcode=t2.fundcode);|20.997    
  21.023    
  20.991    
  **均值:21.004 **    
|2.818    
  2.813    
  2.814    
  **均值:2.815 **    
|走优化 2.5|不走优化 2.5,  
|0.46  
0.45
0.44
  **均值：**  0.450|7.461 |2.733 |
|8|exists子查询在父查询的投影列|select exists (select    
  DISTRIBUTORCODE    
  from (select    
  count(*)    
  from    
  bal_detail_000 t1    
  inner join bal_frozen_detail_000 t2 on t1.fundcode = t2.fundcode    
  )) as c1,    
  TAACCOUNTID     
  from acct_loaning_clear;|1.806    
  1.794    
  1.79    
  **均值:1.797 **    
|1.8    
  1.802    
  1.795    
  **均值:1.799 **    
|走优化 3.0|不走优化  十分51s|1.05  
1.06
1.04
  **均值：**  1.050|0.999 |  
|
|9|exists子查询在子查询的投影列|select count(*)    
  from bal_detail_000 t1 where exists     
  (select taaccountid,distributorcode,(    
  select    
  DISTRIBUTORCODE    
  from    
  (select    
  count(*)    
  from    
  bal_detail_000 t2    
  inner join bal_frozen_detail_000 t3 on t2.fundcode = t3.fundcode    
  )) as c2 from bal_frozen_detail_000);|1.21    
  1.195    
  1.193    
  **均值:1.199 **    
|1.207    
  1.206    
  1.23    
  **均值:1.214 **    
|优化 2.4s|优化 13.1|1.04  
1.05
1.05
  **均值：**  1.047|0.988 |2.823 |
|10|exists子查询在case when中|select count(*)    
  from (select taaccountid,distributorcode,branchcode,fundcode,    
  max(case when BALSTATUS='0' then 1 else 0 end)as a,    
  avg(fundvol) as su    
  from bal_detail_000 t1 group by taaccountid,distributorcode,branchcode,fundcode having exists (select TASERIALNO     
  from     
  bal_frozen_detail_000 t2 where t2.taaccountid=t1.taaccountid and t2.BRANCHCODE=t1.BRANCHCODE    
  and t2.distributorcode > '205'));|17.469    
  17.442    
  17.575    
  **均值:17.495 **    
|7.569    
  6.694    
  6.605    
  **均值:6.956 **    
|优化 7.5s|不优化 7.5s|  
|2.515 |2.134 |
|11|exists子查询在having中|select count(*)   from (select taaccountid,distributorcode,branchcode,fundcode,    
               max(case when BALSTATUS='0' then 1 else 0 end)as a,    
               avg(fundvol) as su   from bal_detail_000 t1 group by taaccountid,distributorcode,branchcode,fundcode having exists (select TASERIALNO   from   bal_frozen_detail_000 t2 where t2.taaccountid=t1.taaccountid and t2.BRANCHCODE=t1.BRANCHCODE   and t2.distributorcode > '205'));|6.399    
  6.391    
  6.379    
  **均值:6.390 **    
|6.431    
  6.436    
  6.431    
  **均值:6.433 **    
|优化  6.3s|不优化  6.3s|0.45  
0.45
0.45
  **均值：**  0.450|0.993 |1.922 |
|12|exists子查询在where之后,join在子查询内|select count(*)    
  from (select tano,taaccountid,distributorcode,branchcode,fundcode,    
  max(case when BALSTATUS='0' then 1 else 0 end)as a,    
  max(case source when '2' then LASTFUNDVOL else 0 end) as b,    
  avg(fundvol) as su    
  from bal_detail_000     
  group by tano,taaccountid,distributorcode,branchcode,fundcode) t1     
  where (distributorcode > 200) or exists (select BALSTATUS     
  from     
  bal_detail_000 t2     
  inner join bal_frozen_detail_000 t3 on t2.tano=t3.tano    
  inner join cfg_realtfundseatagency_clear t4 on t1.fundcode=t4.fundcode    
  inner join acct_loaning_clear t5 on t1.distributorcode=t5.distributorcode    
  where t4.DISTRIBUTORCODE>=75);|8.232    
  8.232    
  8.227    
  **均值:8.230 **    
|8.257    
  8.250    
  8.237    
  **均值:8.248 **    
|优化 9.5s|不优化 9.5s|3.25  
3.31
3.23
  **均值：**  3.263|0.998 |2.131 |
|13|exists子查询在where之后,join在子查询外|select count(*) FROM    
  (SELECT t1.taaccountid,t1.distributorcode,t1.branchcode,t1.transactionaccountid,t1.fundcode,t1.taserialno FROM    
  bal_detail_000 t1    
  LEFT JOIN bal_frozen_detail_000 t2     
  on    
  t2.fundcode = t1.fundcode    
  AND    
  t2.taaccountid = t1.taaccountid    
  AND    
  t2.origintaserialno = t1.taserialno WHERE t2.unfrozenflag = 'N'    
  ) t    
  WHERE    
  (t.distributorcode = '205' and substr(t.transactionaccountid, 14, 1) = 1)    
  OR exists (    
  select DISTRIBUTORCODE from cfg_realtfundseatagency_clear a    
  where a.distributorcode = t.distributorcode    
  and a.fundcode = t.fundcode);|2.408    
  2.406    
  2.398    
  **均值:2.404 **    
|2.396    
  2.393    
  2.395    
  **均值:2.395 **    
|  
3.4|  
3.4|3.59  
3.42
3.38
  **均值：**  3.463|1.004 |2.828 |
|14|兄弟关联：,where in子查询 or exists子查询|select count(*)    
  from (select * from (    
  select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000    
  union all    
  select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from BAL_FROZEN_DETAIL_000    
  ) t1    
  where (t1.distributorcode is not null)     
  and fundcode in    
  (select fundcode     
  from     
  ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode)    
  or    
  exists (    
  select 1 from cfg_realtfundseatagency_clear t3    
  where t3.distributorcode = t1.distributorcode    
  and t3.fundcode = t1.fundcode));|18.641    
  18.717    
  18.691    
  **均值:18.683 **    
|7.808    
  7.806    
  7.798    
  **均值:7.804 **    
|--优化 9.7s|不优化 22.8s|4.05  
3.85
3.8
  **均值：**  3.900|2.394 |1.367 |
|15|兄弟关联：,where in子查询 and exists子查询|select count(*)    
  from (    
  select * from (    
  select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from bal_detail_000    
  union all    
  select tano,distributorcode,taaccountid,fundcode,BRANCHCODE,TRANSACTIONACCOUNTID from BAL_FROZEN_DETAIL_000    
  ) t1    
  where (t1.distributorcode is not null)     
  and fundcode not in    
  (select fundcode     
  from     
  ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode)    
  and ( t1.distributorcode !=0 or     
  exists (    
  select 1 from cfg_realtfundseatagency_clear t3    
  where t3.distributorcode = t1.distributorcode    
  and t3.fundcode = t1.fundcode)));|38.375    
  38.400    
  38.378    
  **均值:38.384 **    
|26.974    
  26.822    
  26.932    
  **均值:26.909 **    
|优化 14.6|不优化 46s|6.12  
6.16
6.12
  **均值：**  6.133|1.426 |10.204 |
|16|双层关联子查询，子查询和父查询分别嵌套爷查询|select count(*)    
  from bal_detail_000 t1     
  where t1.distributorcode in     
  (select distributorcode    
  from (select * from BAL_FROZEN_DETAIL_000 t2 where t1.fundcode = t2.fundcode) t where t1.distributorcode !=0 or EXISTS (    
  select 1 from cfg_realtfundseatagency_clear t3     
  where t3.distributorcode = t1.distributorcode    
  and t3.fundcode = t1.fundcode));|36.723    
  36.805    
  36.734    
  **均值:36.754**|22.392    
  22.394    
  22.368    
  **均值:22.384**|优化 22s|不优化 43|2.46  
2.45
2.47
  **均值：**  2.460|1.642 |3.392 |
|17|双层关联子查询，子查询嵌套父查询，父查询嵌套爷查询|select count(*)    
  from     
  bal_detail_000 t1    
  where (t1.distributorcode is not null)     
  and     
  fundcode not in    
  (select fundcode     
  from     
  ACCT_LOANING_CLEAR t2 where t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode     
  and (t1.taaccountid !=0 or exists (    
  select 1 from cfg_realtfundseatagency_clear t3    
  where t3.distributorcode = t2.distributorcode)));|30.464    
  30.442    
  30.383    
  **均值:30.416**|30.578    
  30.675    
  30.602    
  **均值:30.618**|优化 5s|-不优化 33s|6.42  
6.48
6.41
  **均值：**  6.437|0.993 |20.412 |
|18|双层关联子查询，子查询分别嵌套父查询和爷查询|select count(*)    
  from     
  bal_detail_000 t1    
  where (t1.distributorcode is not null)     
  and     
  fundcode not in    
  (select fundcode     
  from     
  ACCT_LOANING_CLEAR t2 where t1.tano = t2.tano and t1.TRANSACTIONACCOUNTID=t2.TRANSACTIONACCOUNTID and t1.taaccountid=t2.taaccountid and t1.distributorcode=t2.distributorcode     
  or exists (    
  select 1 from BAL_FROZEN_DETAIL_000 t3    
  where t3.taaccountid = t2.distributorcode     
  and t3.distributorcode = t2.distributorcode     
  and t3.TRANSACTIONACCOUNTID = t1.TRANSACTIONACCOUNTID     
  and t3.FUNDCODE = t1.FUNDCODE));|4725.901    
  **均值:4725.901**|867.957    
  867.858    
  **均值:867.907**|  
优化61s|  
|1.38  
1.39
1.38
  **均值：**  1.383|5.445 |14.865 |
|19|复杂查询（外场语句）|select count(*) FROM    
  (    
      SELECT tano,taaccountid,distributorcode,branchcode,transactionaccountid,fundcode FROM (    
          SELECT    
              CASE WHEN t1.balstatus='0' THEN 0 ELSE NVL(t1.lastfundvol, 0)+NVL(t1.fundvol, 0)-NVL(t3.abnmfrozenvol, 0) END AS available,t1.tano,t1.TAACCOUNTID,t1.distributorcode,t1.transactionaccountid,t1.fundcode,t1.sharetype,branchcode,FOOTINCOME     
          FROM    
              bal_detail_000 t1    
          LEFT JOIN (    
          SELECT    
              t2.tano, t2.fundcode, t2.taaccountid, t2.distributorcode,t2.transactionaccountid, t2.origintaserialno,t2.sharetype,SUM(NVL(t2.frozen, 0) + NVL(t2.lastfrozen, 0)) AS abnmfrozenvol     
          FROM    
              bal_frozen_detail_000 t2    
          WHERE    
              t2.unfrozenflag = 'N'    
          GROUP BY    
              t2.tano, t2.fundcode, t2.taaccountid, t2.distributorcode,t2.transactionaccountid, t2.origintaserialno,t2.sharetype) t3    
          ON    
              t3.tano = t1.tano    
          AND    
              t3.fundcode = t1.fundcode    
          AND    
              t3.taaccountid = t1.taaccountid    
          AND    
              t3.distributorcode = t1.distributorcode    
          AND    
              t3.transactionaccountid = t1.transactionaccountid    
          AND     
              t3.sharetype = t1.sharetype    
          AND    
              t3.origintaserialno = t1.taserialno    
      ) t    
      WHERE    
          (t.distributorcode = '205' and substr(t.transactionaccountid, 14, 1) = 1)    
      OR EXISTS (    
              select 1 from cfg_realtfundseatagency_clear a    
              where a.distributorcode = t.distributorcode    
              and a.fundcode = t.fundcode    
      )    
      OR EXISTS (    
          select 1 from acct_loaning_clear a    
          where a.distributorcode = t.distributorcode    
          and a.taaccountid = t.taaccountid    
          and a.transactionaccountid = t.transactionaccountid    
          and a.distributorcode = '205'    
          and a.loaningstatus = '1'    
          and a.effectivestatus = 'N'    
      )    
  );|55.597    
  55.295    
  55.077    
  **均值:55.323**|17.107    
  17.217    
  17.387    
  **均值:17.237**|优化 17s|不优化 66s|4.86  
4.88
4.84
  **均值：**  4.860|3.210 |3.017 |
||||||||6.35  
6.38
6.38
  **均值：**  6.370|||



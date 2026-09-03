Created by 叶显昊, last modified by  张鹏飞 on 六月 27, 2023

#   [YDBRD-13295 : ST_Transform Design（ST_Transform方案设计）](#ydbrd-13295--st-transform-designst-transform方案设计)  

SR链接：

  [https://jira.yasdb.com/browse/YDBRD-13294](https://jira.yasdb.com/browse/YDBRD-13294)  

  [https://jira.yasdb.com/browse/YDBRD-15251](https://jira.yasdb.com/browse/YDBRD-15251)  

##   [1. Overview（概述）](#1-overview概述)  

###   [语法](#语法)  

```
geometry ST_Transform(geometry g1, integer srid);

```

##   [2. Features（功能特性）](#2-features功能特性)  

|参数1|参数2|设计表现|行为说明|
|---|---|---|---|
|geometry类型，srid在spatial_ref_sys表中，且支持转换|合法输入|返回从原空间参考系转换到新空间参考系的geometry|预期行为|
|geometry类型，srid不在spatial_ref_sys表中（包括0）|合法输入|报错|srid对应的空间参考系未定义|
|geometry类型，srid为0|合法输入|报错|不支持srid为0的转换|
|合法类型，NULL|合法输入|返回NULL|任一参数为空返回空|
|合法输入|int类型，在spatial_ref_sys表中|返回从原空间参考系转换到新空间参考系的geometry|预期行为|
|合法输入|int类型，不在spatial_ref_sys表中|报错|srid对应的空间参考系未定义|
|合法输入|其它数字类型|超过int范围溢出报错；小数部分四舍五入，参数2同int类型|支持数字类型向整数转换|
|合法输入|字符串类型，可以转成数字|参数2同数字类型输入|支持字符串向整数转换|
|合法输入|合法类型，NULL|返回NULL|任一参数为空返回空|
|其它输入||报错|不支持的输入格式|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
static YspiResult geomTransform(YspiHandle hExec);

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 根据自测，一般情况下xy坐标中有nan会报错，而由于在当前实现中point(nan nan)和point empty的表示是一样的，所以point(nan nan)按empty处理，返回empty
- 输入的srid应该在spatial_ref_sys表中定义，否则报错


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [系统表 spatial_ref_sys](#系统表-spatial-ref-sys)  

|字段|类型|说明|
|---|---|---|
|SRID|INTEGER|唯一标识数据库中空间参考系统 (SRS) 的整数代码。|
|AUTH_NAME|VARCHAR(256)|为此参考系统引用的标准或标准机构的名称。|
|AUTH_SRID|INTEGER|auth_name 中引用的权威定义的空间参考系统的 ID。对于 EPSG，即 EPSG 代码。|
|SRTEXT|VARCHAR(2048)|空间参考系统的 WKT 表示|
|PROJ4TEXT|VARCHAR(2048)|特定 SRID 的 PROJ 坐标定义字符串。|
|SRS_TYPE|VARCHAR(64)|空间参考系的坐标类型，取值包括PROJECTED/GEOGRAPHIC2D/GEOCENTRIC/GEOGRAPHIC3D/COMPOUND，其中 GEOGRAPHIC2D 和 GEOGRAPHIC3D 使用大地坐标计算，其它的使用投影坐标计算|


###   [执行流程](#执行流程)  

- 判断fromSrid和toSrid，为0则报错
- 从缓存中找到对应fromSrid和toSrid的空间参考系信息
    - 如果没找到则从系统表spatial_ref_sys中找
        - 在系统表中如果没找到则报错
        - 找到了就放到缓存中
- 根据得到的空间参考系信息，得到用于转换的transformPJ
- 调用接口完成转换
- 特殊情况（根据自测，一般情况下xy坐标中有nan会报错，而由于在当前实现中point(nan nan)和point empty的表示是一样的，所以point(nan nan)按empty处理，返回empty）


```
YspiResult piTransform(YspiHandle hExec, int32_t toSrid, Geometry* geom)
{
    int32_t fromSrid = geom-&gt;srid;
    if (fromSrid == 0 || toSrid == 0) {
        yspiSetError(hExec, "transform for srid 0 is not supported");
        return YSPI_ERROR;
    }

    ProjItem* fromPJItem;
    YSPI_CALL(piGetPJItem(hExec, fromSrid, &amp;fromPJItem));

    ProjItem* toPJItem;
    YSPI_CALL(piGetPJItem(hExec, toSrid, &amp;toPJItem));

    PJContext* projCtx = proj_context_create();
    proj_log_func(projCtx, NULL, projLogFunc);
    PJ* transformPJ = proj_create_crs_to_crs_from_pj(projCtx, fromPJItem-&gt;pj, toPJItem-&gt;pj, NULL, NULL);

    if (transformPJ == NULL) {
        proj_context_destroy(projCtx);
        yspiSetError(hExec, "failed to create transform projection");
        return YSPI_ERROR;
    }

    if (piTransformWithPJ(hExec, transformPJ, geom) != YSPI_SUCCESS) {
        proj_destroy(transformPJ);
        proj_context_destroy(projCtx);
        return YSPI_ERROR;
    }

    geom-&gt;srid = toSrid;

    proj_destroy(transformPJ);
    proj_context_destroy(projCtx);
    return YSPI_SUCCESS;
}

YspiResult piGetPJItem(YspiHandle hExec, int32_t srid, ProjItem** pjItem)
{
    if (srid == SRID_DEFAULT) {
        *pjItem = &amp;gDefaultProjItem;
        return YSPI_SUCCESS;
    }
    *pjItem = (ProjItem*)yspiSearchCache(&amp;gProjCacheCtx.yspiCtx, (uint8_t*)&amp;srid);
    if (*pjItem != NULL) {
        return YSPI_SUCCESS;
    }

    ProjDefText projDefText;
    YSPI_CALL(getProjText(hExec, srid, &amp;projDefText));
    YSPI_CALL(yspiCreateCacheItem(hExec, &amp;gProjCacheCtx.yspiCtx, (uint8_t*)&amp;srid, piMakePJItem, &amp;projDefText, (uint8_t**)pjItem));
    return YSPI_SUCCESS;
}

static YspiResult piTransformLineRing(YspiHandle hExec, PJ* transfromPJ, bool hasZ, bool hasM, LineRing* ring)
{
    uint8_t dims = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);
    if (proj_angular_input(transfromPJ, PJ_FWD)) {
        for (uint32_t i = 0; i &lt; ring-&gt;pointNum; i++) {
            Point2D* point = (Point2D*)(ring-&gt;points + sizeof(double) * dims);
            point-&gt;x = piDegree2Rad(point-&gt;x);
            point-&gt;y = piDegree2Rad(point-&gt;y);
        }
    }

    size_t pointSize = sizeof(double) * dims;
    size_t pointNum = proj_trans_generic(transfromPJ, PJ_FWD,
                                         ring-&gt;points, pointSize, ring-&gt;pointNum,
                                         ring-&gt;points + 1, pointSize, ring-&gt;pointNum,
                                         hasZ ? ring-&gt;points + 2 : NULL, hasZ ? pointSize : 0,hasZ ? ring-&gt;pointNum : 0,
                                         NULL, 0, 0);
    if (pointNum != ring-&gt;pointNum) {
        yspiSetError(hExec, "coordinate transform error");
        return YSPI_ERROR;
    }

    int32_t pj_errno_val = proj_errno_reset(transfromPJ);
    if (pj_errno_val) {
        yspiSetError(hExec, proj_errno_string(pj_errno_val));
        return YSPI_ERROR;
    }

    if (proj_angular_output(transfromPJ, PJ_FWD))
    {
        for (uint32_t i = 0; i &lt; ring-&gt;pointNum; i++) {
            Point2D* point = (Point2D*)(ring-&gt;points + sizeof(double) * dims);
            point-&gt;x = piRad2Degree(point-&gt;x);
            point-&gt;y = piRad2Degree(point-&gt;y);
        }
    }
    return YSPI_SUCCESS;
}

```

###   [指定转换算法](#指定转换算法)  

proj库默认的转换算法在不同的椭球体之间转换时，可能误差较大，需要借助epsg数据库中元数据来生成更精确的转换算法。崖山安装包中不包含epsg数据库，因此可能存在坐标转换误差较大的情况。对于这种情况，DBA可以手动设置转换算法。步骤如下

1. 创建转换算法表    
  create table mdsys.transform_methods(srid_from binary_integer, srid_to binary_integer, projtext varchar(8000), constraint pk_tranform_methods primary key(srid_from, srid_to));    
  grant select on mdsys.transform_methods to public;    
  其中srid_from为源geometry对象的srid    
  srid_to为目标srid,    
  projtext为转换算法的proj格式描述
1. 指定转换算法    
  insert into mdsys.transform_methods values(4326, 4990, '+proj=pipeline +step +proj=unitconvert +xy_in=deg +xy_out=rad +step +proj=push +v_3 +step +proj=cart +ellps=WGS84 +step +proj=helmert +x=-43.933 +y=129.593 +z=39.331 +step +inv +proj=cart +ellps=krass +step +proj=pop +v_3 +step +proj=cart +ellps=krass');    
  insert into mdsys.transform_methods values(4326, 29701, '+proj=pipeline +step +proj=unitconvert +xy_in=deg +xy_out=rad +step +proj=push +v_3 +step +proj=cart +ellps=WGS84 +step +proj=helmert +x=198.383 +y=240.517 +z=107.909 +step +inv +proj=cart +ellps=intl +step +proj=pop +v_3 +step +proj=labrd +lat_0=-18.9 +lon_0=44.1 +azi=18.9 +k=0.9995 +x_0=400000 +y_0=800000 +ellps=intl +pm=paris');
1. 重启数据库


具体转换算法生成方式如下：

1. 下载proj源码编译
1. 执行projinfo -s EPSG:4326 -t EPSG:4990 --normalize-axis-order -o PROJ --single-line 将输出转换算法的proj格式描述


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 输入为空的情况，按预期返回空
- 输入srid为0，按预期报错
- 输入srid不在spatial_ref_sys中，按预期报错
- 输入不合法坐标，按预期报错
- 输入empty，返回empty
- 正常输入，预期与postgis对齐


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
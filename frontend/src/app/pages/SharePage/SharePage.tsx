/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import useMount from 'app/hooks/useMount';
import useRouteQuery from 'app/hooks/useRouteQuery';
import { loadShareTask, makeShareDownloadDataTask } from 'app/utils/fetch';
import { StorageKeys } from 'globalConstants';
import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import persistence from 'utils/persistence';
import { v4 as uuidv4 } from 'uuid';
import ChartRequest from '../ChartWorkbenchPage/models/ChartHttpRequest';
import { useEditBoardSlice } from '../DashBoardPage/pages/BoardEditor/slice';
import { useBoardSlice } from '../DashBoardPage/pages/Dashboard/slice';
import { selectShareBoard } from '../DashBoardPage/pages/Dashboard/slice/selector';
import { VizRenderMode } from '../DashBoardPage/pages/Dashboard/slice/types';
import { FilterSearchParams } from '../MainPage/pages/VizPage/slice/types';
import { urlSearchTransfer } from '../MainPage/pages/VizPage/utils';
import { useStoryBoardSlice } from '../StoryBoardPage/slice';
import { selectShareStoryBoard } from '../StoryBoardPage/slice/selectors';
import BoardForShare from './BoardForShare';
import ChartPreviewBoardForShare from './ChartPreviewBoardForShare';
import { DownloadTaskContainer } from './DownloadTaskContainer';
import PasswordModal from './PasswordModal';
import { downloadShareDataChartFile } from './sercive';
import { useShareSlice } from './slice';
import {
  selectChartPreview,
  selectNeedPassword,
  selectShareExecuteTokenMap,
  selectSharePassword,
  selectShareVizType,
} from './slice/selectors';
import { fetchShareVizInfo } from './slice/thunks';
import { StoryPlayerForShare } from './StoryPlayerForShare';
export function SharePage() {
  const { shareActions: actions } = useShareSlice();
  useEditBoardSlice();
  useBoardSlice();
  useStoryBoardSlice();

  const dispatch = useDispatch();
  const location = useLocation();
  const search = location.search;

  const [shareClientId, setShareClientId] = useState('');
  const executeTokenMap = useSelector(selectShareExecuteTokenMap);
  const needPassword = useSelector(selectNeedPassword);
  const sharePassword = useSelector(selectSharePassword);
  const chartPreview = useSelector(selectChartPreview);
  const shareBoard = useSelector(selectShareBoard);
  const shareStory = useSelector(selectShareStoryBoard);
  const vizType = useSelector(selectShareVizType);

  const shareToken = useRouteQuery({
    key: 'token',
  }) as string;
  const usePassword = useRouteQuery({
    key: 'usePassword',
  });
  // in timed task eager=true for disable board lazyLoad
  const eager = useRouteQuery({
    key: 'eager',
  });
  const renderMode: VizRenderMode = eager ? 'schedule' : 'share';

  const searchParams = useMemo(() => {
    return urlSearchTransfer.toParams(search);
  }, [search]);

  useMount(() => {
    if (Boolean(usePassword)) {
      const previousPassword = persistence.session.get(shareToken);
      if (previousPassword) {
        fetchShareVizInfoImpl(shareToken, previousPassword, searchParams);
      } else {
        dispatch(actions.saveNeedPassword(true));
      }
    } else {
      fetchShareVizInfoImpl(shareToken, undefined, searchParams);
    }
  });

  const fetchShareVizInfoImpl = (
    token?: string,
    pwd?: string,
    params?: FilterSearchParams,
  ) => {
    dispatch(
      fetchShareVizInfo({
        shareToken: token,
        sharePassword: pwd,
        filterSearchParams: params,
        renderMode,
      }),
    );
  };

  useMount(() => {
    if (Boolean(usePassword)) {
      const previousPassword = persistence.session.get(shareToken);
      if (previousPassword) {
        fetchShareVizInfoImpl(shareToken, previousPassword, searchParams);
      } else {
        dispatch(actions.saveNeedPassword(true));
      }
    } else {
      fetchShareVizInfoImpl(shareToken, undefined, searchParams);
    }
  });

  const onLoadShareTask = useMemo(() => {
    const clientId = localStorage.getItem(StorageKeys.ShareClientId);
    if (clientId) {
      setShareClientId(clientId);
    } else {
      const id = uuidv4();
      setShareClientId(id);
      localStorage.setItem(StorageKeys.ShareClientId, uuidv4());
    }
    return () =>
      loadShareTask({
        shareToken,
        password: sharePassword,
        clientId: shareClientId,
      });
  }, [shareToken, sharePassword, shareClientId]);

  const onMakeShareDownloadDataTask = useCallback(
    (downloadParams: ChartRequest[], fileName: string) => {
      if (shareClientId && executeTokenMap) {
        dispatch(
          makeShareDownloadDataTask({
            clientId: shareClientId,
            executeToken: executeTokenMap,
            downloadParams: downloadParams,
            shareToken,
            fileName: fileName,
            resolve: () => {
              dispatch(actions.setShareDownloadPolling(true));
            },
            password: sharePassword,
          }),
        );
      }
    },
    [
      shareClientId,
      shareToken,
      sharePassword,
      executeTokenMap,
      dispatch,
      actions,
    ],
  );

  const onDownloadFile = useCallback(
    task => {
      downloadShareDataChartFile({
        downloadId: task.id,
        shareToken,
        password: sharePassword,
      }).then(() => {
        dispatch(actions.setShareDownloadPolling(true));
      });
    },
    [shareToken, sharePassword, dispatch, actions],
  );

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PasswordModal
        visible={Boolean(needPassword) && Boolean(usePassword)}
        onChange={sharePassword => {
          fetchShareVizInfoImpl(shareToken, sharePassword);
        }}
      />
      {!Boolean(needPassword) &&
        vizType === 'DATACHART' &&
        chartPreview &&
        chartPreview?.backendChart && (
          <DownloadTaskContainer
            onLoadTasks={onLoadShareTask}
            onDownloadFile={onDownloadFile}
          >
            <ChartPreviewBoardForShare
              chartPreview={chartPreview}
              onCreateDataChartDownloadTask={onMakeShareDownloadDataTask}
            />
          </DownloadTaskContainer>
        )}
      {!Boolean(needPassword) && vizType === 'DASHBOARD' && shareBoard && (
        <BoardForShare
          dashboard={shareBoard}
          allowDownload={true}
          onMakeShareDownloadDataTask={onMakeShareDownloadDataTask}
          renderMode={renderMode}
          filterSearchUrl={''}
          onLoadShareTask={onLoadShareTask}
          onDownloadFile={onDownloadFile}
        />
      )}
      {!Boolean(needPassword) && vizType === 'STORYBOARD' && shareStory && (
        <StoryPlayerForShare storyBoard={shareStory} />
      )}
    </div>
  );
}